import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  buildInviteSk,
  buildMemberSk,
  buildMetaSk,
  buildRoomPk,
  fromRoomInviteItem,
  fromRoomMemberItem,
  fromRoomMetaItem,
  toRoomInviteItem,
  toRoomMemberItem,
  toRoomMetaItem,
} from '../mappers/rooms-dynamodb.mapper';
import type { RoomInvite } from '../entities/room-invite.entity';
import type { RoomMember } from '../entities/room-member.entity';
import type { Room } from '../entities/room.entity';
import {
  RoomAlreadyExistsError,
  type RoomsRepository,
} from './rooms.repository';

@Injectable()
export class DynamoDBRoomsRepository implements RoomsRepository {
  private readonly logger = new Logger(DynamoDBRoomsRepository.name);
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string | undefined;
  private readonly region: string;
  private readonly endpoint: string | undefined;
  private readonly profile: string | undefined;
  private readonly hasStaticCredentials: boolean;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('AWS_REGION') ?? 'eu-central-1';
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

    this.tableName = this.configService.get<string>('DYNAMODB_ROOMS_TABLE');

    this.logger.log(
      [
        'driver=dynamodb initialized',
        `region=${this.region}`,
        `table=${this.tableName ?? '(unset)'}`,
        `profile=${this.profile ?? '(none)'}`,
        `endpoint=${this.endpoint ?? '(aws-default)'}`,
        `hasStaticCredentials=${this.hasStaticCredentials}`,
      ].join(' '),
    );

    void this.logCallerIdentity(clientConfig);
  }

  async createRoom(room: Room): Promise<Room> {
    const tableName = this.getRequiredTableName();
    this.logger.log(
      `createRoom roomId=${room.roomId} hostUserId=${room.hostUserId} table=${tableName}`,
    );
    const item = toRoomMetaItem(room);

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
          ConditionExpression:
            'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        }),
      );
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        throw new RoomAlreadyExistsError(room.roomId);
      }

      throw this.toInfrastructureException('createRoom', error);
    }

    return room;
  }

  async updateRoom(room: Room): Promise<Room> {
    const tableName = this.getRequiredTableName();
    this.logger.log(`updateRoom roomId=${room.roomId}`);
    const item = toRoomMetaItem(room);

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
          ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('updateRoom', error);
    }

    return room;
  }

  async deleteRoom(roomId: string): Promise<void> {
    const tableName = this.getRequiredTableName();
    this.logger.log(`deleteRoom roomId=${roomId} table=${tableName}`);
    const pk = buildRoomPk(roomId);

    let itemsToDelete: Record<string, unknown>[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    try {
      // Query all items in the partition
      do {
        const response = await this.documentClient.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
              ':pk': pk,
            },
            ProjectionExpression: 'SK',
            ...(lastEvaluatedKey
              ? { ExclusiveStartKey: lastEvaluatedKey }
              : {}),
          }),
        );

        itemsToDelete.push(
          ...(response.Items ?? []).map((item) => asRecord(item) ?? {}),
        );
        lastEvaluatedKey = asRecord(response.LastEvaluatedKey);
      } while (lastEvaluatedKey);

      // Now delete item by item (or we could use BatchWriteItem if we chunked it,
      // but sequential is fine since room deletions are rare and normally have few items)
      for (const item of itemsToDelete) {
        if (item.SK) {
          await this.documentClient.send(
            new DeleteCommand({
              TableName: tableName,
              Key: {
                PK: pk,
                SK: item.SK,
              },
            }),
          );
        }
      }
    } catch (error) {
      throw this.toInfrastructureException('deleteRoom', error);
    }
  }

  async listRooms(): Promise<Room[]> {
    const tableName = this.getRequiredTableName();
    this.logger.log(`listRooms table=${tableName}`);

    const items: Record<string, unknown>[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    try {
      do {
        const response = await this.documentClient.send(
          new ScanCommand({
            TableName: tableName,
            FilterExpression: '#entityType = :entityType AND #sk = :metaSk',
            ExpressionAttributeNames: {
              '#entityType': 'entityType',
              '#sk': 'SK',
            },
            ExpressionAttributeValues: {
              ':entityType': 'ROOM',
              ':metaSk': 'META',
            },
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
      throw this.toInfrastructureException('listRooms', error);
    }

    const rooms = items
      .map((item) => fromRoomMetaItem(item))
      .filter((room): room is Room => room !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    this.logger.log(`listRooms result count=${rooms.length}`);

    return rooms;
  }

  async getRoomById(roomId: string): Promise<Room | null> {
    const tableName = this.getRequiredTableName();
    this.logger.log(
      `getRoomById roomId=${roomId} table=${tableName} pk=${buildRoomPk(roomId)}`,
    );
    let response;

    try {
      response = await this.documentClient.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: buildRoomPk(roomId),
            SK: buildMetaSk(),
          },
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('getRoomById', error);
    }

    const room = fromRoomMetaItem(asRecord(response.Item));
    this.logger.log(
      `getRoomById result roomId=${roomId} found=${Boolean(room)}`,
    );
    return room;
  }

  async addMember(member: RoomMember): Promise<RoomMember> {
    const tableName = this.getRequiredTableName();
    this.logger.log(
      `addMember roomId=${member.roomId} userId=${member.userId}`,
    );
    const item = toRoomMemberItem(member);

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
          ConditionExpression:
            'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        }),
      );

      return member;
    } catch (error) {
      if (!isConditionalCheckFailed(error)) {
        throw this.toInfrastructureException('addMember', error);
      }

      const existingMember = await this.getMember(member.roomId, member.userId);
      if (!existingMember) {
        throw this.toInfrastructureException('addMember', error);
      }

      return existingMember;
    }
  }

  async getMember(roomId: string, userId: string): Promise<RoomMember | null> {
    const tableName = this.getRequiredTableName();
    let response;

    try {
      response = await this.documentClient.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: buildRoomPk(roomId),
            SK: buildMemberSk(userId),
          },
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('getMember', error);
    }

    return fromRoomMemberItem(asRecord(response.Item));
  }

  async getMembersByRoomId(roomId: string): Promise<RoomMember[]> {
    const tableName = this.getRequiredTableName();
    this.logger.log(`getMembersByRoomId roomId=${roomId} table=${tableName}`);
    let response;

    try {
      response = await this.documentClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :memberPrefix)',
          ExpressionAttributeValues: {
            ':pk': buildRoomPk(roomId),
            ':memberPrefix': 'MEMBER#',
          },
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('getMembersByRoomId', error);
    }

    const members = (response.Items ?? [])
      .map((item) => fromRoomMemberItem(asRecord(item)))
      .filter((member): member is RoomMember => member !== null)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

    this.logger.log(
      `getMembersByRoomId result roomId=${roomId} count=${members.length}`,
    );

    return members;
  }

  async countMembers(roomId: string): Promise<number> {
    const tableName = this.getRequiredTableName();
    let response;

    try {
      response = await this.documentClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :memberPrefix)',
          ExpressionAttributeValues: {
            ':pk': buildRoomPk(roomId),
            ':memberPrefix': 'MEMBER#',
          },
          Select: 'COUNT',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('countMembers', error);
    }

    return response.Count ?? 0;
  }

  async createInvite(invite: RoomInvite): Promise<RoomInvite> {
    const tableName = this.getRequiredTableName();
    const item = toRoomInviteItem(invite);

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
          ConditionExpression:
            'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('createInvite', error);
    }

    return invite;
  }

  async getInviteByCode(inviteCode: string): Promise<RoomInvite | null> {
    const tableName = this.getRequiredTableName();
    let response;

    try {
      response = await this.documentClient.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression:
            '#entityType = :entityType AND inviteCode = :inviteCode',
          ExpressionAttributeNames: {
            '#entityType': 'entityType',
          },
          ExpressionAttributeValues: {
            ':entityType': 'ROOM_INVITE',
            ':inviteCode': inviteCode,
          },
          Limit: 1,
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('getInviteByCode', error);
    }

    const inviteItem = response.Items?.[0];
    return fromRoomInviteItem(asRecord(inviteItem));
  }

  private getRequiredTableName(): string {
    if (!this.tableName) {
      throw new InternalServerErrorException(
        'DYNAMODB_ROOMS_TABLE is required when ROOMS_REPOSITORY_DRIVER=dynamodb',
      );
    }

    return this.tableName;
  }

  private toInfrastructureException(operation: string, error: unknown): Error {
    const errorName = getErrorName(error);

    if (errorName === 'CredentialsProviderError') {
      return new ServiceUnavailableException(
        [
          'DynamoDB credentials are missing.',
          `region=${this.region}`,
          `table=${this.tableName ?? '(unset)'}`,
          `profile=${this.profile ?? '(none)'}`,
          'Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (optionally AWS_SESSION_TOKEN), or configure AWS_PROFILE and run aws sso login.',
        ].join(' '),
      );
    }

    if (errorName === 'ResourceNotFoundException') {
      return new ServiceUnavailableException(
        `DynamoDB table \"${this.getRequiredTableName()}\" was not found in region \"${this.region}\".`,
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

function getErrorName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('name' in error)) {
    return undefined;
  }

  const value = (error as { name: unknown }).name;
  return typeof value === 'string' ? value : undefined;
}
