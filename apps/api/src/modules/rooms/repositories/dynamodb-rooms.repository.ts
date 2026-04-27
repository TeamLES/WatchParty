import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getErrorName } from '../../../common/aws/aws-errors';
import {
  requireDynamoDbTableNames,
  type DynamoDbTableNameKey,
} from '../../../common/dynamodb/dynamodb-table-names';
import type { RoomInvite } from '../entities/room-invite.entity';
import type { RoomMember } from '../entities/room-member.entity';
import type { Room } from '../entities/room.entity';
import {
  fromRoomInviteItem,
  fromRoomItem,
  fromRoomMemberItem,
  toRoomInviteItem,
  toRoomItem,
  toRoomMemberItem,
} from '../mappers/rooms-dynamodb.mapper';
import {
  RoomAlreadyExistsError,
  type RoomsRepository,
} from './rooms.repository';

@Injectable()
export class DynamoDBRoomsRepository implements RoomsRepository {
  private readonly logger = new Logger(DynamoDBRoomsRepository.name);
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly region: string;
  private readonly endpoint: string | undefined;
  private readonly profile: string | undefined;
  private readonly hasStaticCredentials: boolean;
  private readonly tables: Record<DynamoDbTableNameKey, string>;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('AWS_REGION')?.trim() ?? 'eu-central-1';
    const endpoint = this.configService.get<string>('DYNAMODB_ENDPOINT');
    const profile = this.configService.get<string>('AWS_PROFILE');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    const sessionToken = this.configService.get<string>('AWS_SESSION_TOKEN');
    this.region = region;
    this.endpoint = endpoint;
    this.profile = profile;

    const staticCredentials =
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
          }
        : undefined;
    this.hasStaticCredentials = Boolean(staticCredentials);

    const clientConfig = {
      region,
      ...(endpoint ? { endpoint } : {}),
      ...(staticCredentials ? { credentials: staticCredentials } : {}),
    };

    const ddbClient = new DynamoDBClient(clientConfig);

    this.documentClient = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    this.tables = requireDynamoDbTableNames(
      this.configService,
      ['rooms', 'roomMembers', 'invites'],
      DynamoDBRoomsRepository.name,
    );

    this.logger.log(
      [
        'driver=dynamodb initialized',
        `region=${this.region}`,
        `roomsTable=${this.tables.rooms}`,
        `roomMembersTable=${this.tables.roomMembers}`,
        `invitesTable=${this.tables.invites}`,
        `profile=${this.profile ?? '(none)'}`,
        `endpoint=${this.endpoint ?? '(aws-default)'}`,
        `hasStaticCredentials=${this.hasStaticCredentials}`,
      ].join(' '),
    );

    void this.logCallerIdentity(clientConfig);
  }

  async createRoom(room: Room): Promise<Room> {
    this.logger.log(
      `createRoom roomId=${room.roomId} hostUserId=${room.hostUserId} table=${this.tables.rooms}`,
    );
    const item = toRoomItem({
      ...room,
      updatedAt: room.updatedAt ?? room.createdAt,
    });

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tables.rooms,
          Item: item,
          ConditionExpression: 'attribute_not_exists(roomId)',
        }),
      );
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        throw new RoomAlreadyExistsError(room.roomId);
      }

      throw this.toInfrastructureException('createRoom', error, 'rooms');
    }

    return room;
  }

  async updateRoom(room: Room): Promise<Room> {
    this.logger.log(`updateRoom roomId=${room.roomId}`);
    const item = toRoomItem({
      ...room,
      updatedAt: room.updatedAt ?? new Date().toISOString(),
    });

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tables.rooms,
          Item: item,
          ConditionExpression: 'attribute_exists(roomId)',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('updateRoom', error, 'rooms');
    }

    return {
      ...room,
      updatedAt: item.updatedAt,
    };
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.logger.log(`deleteRoom roomId=${roomId}`);

    try {
      await this.documentClient.send(
        new DeleteCommand({
          TableName: this.tables.rooms,
          Key: { roomId },
        }),
      );

      await this.deleteRoomMembers(roomId);
      await this.deleteRoomInvites(roomId);

      // TODO: add cleanup for chat messages, playback snapshots, and reactions.
    } catch (error) {
      throw this.toInfrastructureException('deleteRoom', error);
    }
  }

  async listRooms(): Promise<Room[]> {
    this.logger.log(`listRooms table=${this.tables.rooms}`);

    const items: Record<string, unknown>[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    try {
      do {
        const response = await this.documentClient.send(
          new ScanCommand({
            TableName: this.tables.rooms,
            ...(lastEvaluatedKey
              ? { ExclusiveStartKey: lastEvaluatedKey }
              : {}),
          }),
        );

        items.push(
          ...(response.Items ?? []).map((item) => asRecord(item) ?? {}),
        );
        lastEvaluatedKey = asRecord(response.LastEvaluatedKey);
      } while (lastEvaluatedKey);
    } catch (error) {
      throw this.toInfrastructureException('listRooms', error, 'rooms');
    }

    const rooms = items
      .map((item) => fromRoomItem(item))
      .filter((room): room is Room => room !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    this.logger.log(`listRooms result count=${rooms.length}`);

    return rooms;
  }

  async getRoomById(roomId: string): Promise<Room | null> {
    this.logger.log(`getRoomById roomId=${roomId} table=${this.tables.rooms}`);
    let response;

    try {
      response = await this.documentClient.send(
        new GetCommand({
          TableName: this.tables.rooms,
          Key: {
            roomId,
          },
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('getRoomById', error, 'rooms');
    }

    const room = fromRoomItem(asRecord(response.Item));
    this.logger.log(
      `getRoomById result roomId=${roomId} found=${Boolean(room)}`,
    );
    return room;
  }

  async addMember(member: RoomMember): Promise<RoomMember> {
    this.logger.log(
      `addMember roomId=${member.roomId} userId=${member.userId}`,
    );
    const item = toRoomMemberItem(member);

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tables.roomMembers,
          Item: item,
          ConditionExpression:
            'attribute_not_exists(roomId) AND attribute_not_exists(userId)',
        }),
      );

      return member;
    } catch (error) {
      if (!isConditionalCheckFailed(error)) {
        throw this.toInfrastructureException('addMember', error, 'roomMembers');
      }

      const existingMember = await this.getMember(member.roomId, member.userId);
      if (!existingMember) {
        throw this.toInfrastructureException('addMember', error, 'roomMembers');
      }

      return existingMember;
    }
  }

  async getMember(roomId: string, userId: string): Promise<RoomMember | null> {
    let response;

    try {
      response = await this.documentClient.send(
        new GetCommand({
          TableName: this.tables.roomMembers,
          Key: {
            roomId,
            userId,
          },
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('getMember', error, 'roomMembers');
    }

    return fromRoomMemberItem(asRecord(response.Item));
  }

  async removeMember(roomId: string, userId: string): Promise<void> {
    this.logger.log(`removeMember roomId=${roomId} userId=${userId}`);

    try {
      await this.documentClient.send(
        new DeleteCommand({
          TableName: this.tables.roomMembers,
          Key: {
            roomId,
            userId,
          },
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException(
        'removeMember',
        error,
        'roomMembers',
      );
    }
  }

  async getMembersByRoomId(roomId: string): Promise<RoomMember[]> {
    this.logger.log(
      `getMembersByRoomId roomId=${roomId} table=${this.tables.roomMembers}`,
    );
    const members: RoomMember[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    try {
      do {
        const response = await this.documentClient.send(
          new QueryCommand({
            TableName: this.tables.roomMembers,
            KeyConditionExpression: 'roomId = :roomId',
            ExpressionAttributeValues: {
              ':roomId': roomId,
            },
            ...(lastEvaluatedKey
              ? { ExclusiveStartKey: lastEvaluatedKey }
              : {}),
          }),
        );

        members.push(
          ...(response.Items ?? [])
            .map((item) => fromRoomMemberItem(asRecord(item)))
            .filter((member): member is RoomMember => member !== null),
        );
        lastEvaluatedKey = asRecord(response.LastEvaluatedKey);
      } while (lastEvaluatedKey);
    } catch (error) {
      throw this.toInfrastructureException(
        'getMembersByRoomId',
        error,
        'roomMembers',
      );
    }

    return members.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  async countMembers(roomId: string): Promise<number> {
    let response;

    try {
      response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tables.roomMembers,
          KeyConditionExpression: 'roomId = :roomId',
          ExpressionAttributeValues: {
            ':roomId': roomId,
          },
          Select: 'COUNT',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException(
        'countMembers',
        error,
        'roomMembers',
      );
    }

    return response.Count ?? 0;
  }

  async createInvite(invite: RoomInvite): Promise<RoomInvite> {
    const item = toRoomInviteItem(invite);

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tables.invites,
          Item: item,
          ConditionExpression: 'attribute_not_exists(inviteCode)',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('createInvite', error, 'invites');
    }

    return invite;
  }

  async getInviteByCode(inviteCode: string): Promise<RoomInvite | null> {
    let response;

    try {
      response = await this.documentClient.send(
        new GetCommand({
          TableName: this.tables.invites,
          Key: {
            inviteCode,
          },
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('getInviteByCode', error, 'invites');
    }

    return fromRoomInviteItem(asRecord(response.Item));
  }

  private async deleteRoomMembers(roomId: string): Promise<void> {
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const queryResponse = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tables.roomMembers,
          KeyConditionExpression: 'roomId = :roomId',
          ExpressionAttributeValues: {
            ':roomId': roomId,
          },
          ProjectionExpression: 'roomId, userId',
          ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
        }),
      );

      for (const item of queryResponse.Items ?? []) {
        const record = asRecord(item);
        const userId =
          record && typeof record.userId === 'string' ? record.userId : null;

        if (!userId) {
          continue;
        }

        await this.documentClient.send(
          new DeleteCommand({
            TableName: this.tables.roomMembers,
            Key: {
              roomId,
              userId,
            },
          }),
        );
      }

      lastEvaluatedKey = asRecord(queryResponse.LastEvaluatedKey);
    } while (lastEvaluatedKey);
  }

  private async deleteRoomInvites(roomId: string): Promise<void> {
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const queryResponse = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tables.invites,
          IndexName: 'room-index',
          KeyConditionExpression: 'roomId = :roomId',
          ExpressionAttributeValues: {
            ':roomId': roomId,
          },
          ProjectionExpression: 'inviteCode',
          ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
        }),
      );

      for (const item of queryResponse.Items ?? []) {
        const record = asRecord(item);
        const inviteCode =
          record && typeof record.inviteCode === 'string'
            ? record.inviteCode
            : null;

        if (!inviteCode) {
          continue;
        }

        await this.documentClient.send(
          new DeleteCommand({
            TableName: this.tables.invites,
            Key: {
              inviteCode,
            },
          }),
        );
      }

      lastEvaluatedKey = asRecord(queryResponse.LastEvaluatedKey);
    } while (lastEvaluatedKey);
  }

  private toInfrastructureException(
    operation: string,
    error: unknown,
    tableKey?: DynamoDbTableNameKey,
  ): Error {
    const errorName = getErrorName(error);
    const tableName = tableKey ? this.tables[tableKey] : '(multiple)';

    if (errorName === 'CredentialsProviderError') {
      return new ServiceUnavailableException(
        [
          'DynamoDB credentials are missing.',
          `region=${this.region}`,
          `table=${tableName}`,
          `profile=${this.profile ?? '(none)'}`,
          'Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (optionally AWS_SESSION_TOKEN), or configure AWS_PROFILE and run aws sso login.',
        ].join(' '),
      );
    }

    if (errorName === 'ResourceNotFoundException') {
      return new ServiceUnavailableException(
        `DynamoDB table "${tableName}" was not found in region "${this.region}".`,
      );
    }

    if (
      errorName === 'AccessDeniedException' ||
      errorName === 'UnrecognizedClientException' ||
      errorName === 'InvalidSignatureException' ||
      errorName === 'ExpiredTokenException'
    ) {
      return new ServiceUnavailableException(
        'DynamoDB request was rejected by AWS. Verify IAM permissions and credential validity.',
      );
    }

    if (
      errorName === 'ThrottlingException' ||
      errorName === 'ProvisionedThroughputExceededException' ||
      errorName === 'RequestLimitExceeded'
    ) {
      return new ServiceUnavailableException(
        `DynamoDB is throttling requests during ${operation}. Retry shortly.`,
      );
    }

    return error instanceof Error
      ? error
      : new ServiceUnavailableException(
          `DynamoDB request failed during ${operation}.`,
        );
  }

  private async logCallerIdentity(clientConfig: {
    region: string;
    endpoint?: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
  }): Promise<void> {
    if (this.endpoint) {
      this.logger.log(
        'Skipping STS account lookup because DYNAMODB_ENDPOINT override is set',
      );
      return;
    }

    try {
      const stsClient = new STSClient(clientConfig);
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));
      this.logger.log(
        `awsAccount=${identity.Account ?? '(unknown)'} awsArn=${identity.Arn ?? '(unknown)'}`,
      );
    } catch (error) {
      this.logger.warn(
        `Unable to resolve AWS account identity: ${getErrorName(error) ?? 'UnknownError'}`,
      );
    }
  }
}

function isConditionalCheckFailed(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'ConditionalCheckFailedException'
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return value as Record<string, unknown>;
}
