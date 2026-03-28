import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  Injectable,
  InternalServerErrorException,
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
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string | undefined;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') ?? 'eu-central-1';
    const endpoint = this.configService.get<string>('DYNAMODB_ENDPOINT');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const sessionToken = this.configService.get<string>('AWS_SESSION_TOKEN');
    this.region = region;

    const staticCredentials =
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
          }
        : undefined;

    const ddbClient = new DynamoDBClient({
      region,
      ...(endpoint ? { endpoint } : {}),
      ...(staticCredentials ? { credentials: staticCredentials } : {}),
    });

    this.documentClient = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    this.tableName = this.configService.get<string>('DYNAMODB_ROOMS_TABLE');
  }

  async createRoom(room: Room): Promise<Room> {
    const item = toRoomMetaItem(room);

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.getRequiredTableName(),
          Item: item,
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
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

  async getRoomById(roomId: string): Promise<Room | null> {
    let response;

    try {
      response = await this.documentClient.send(
        new GetCommand({
          TableName: this.getRequiredTableName(),
          Key: {
            PK: buildRoomPk(roomId),
            SK: buildMetaSk(),
          },
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('getRoomById', error);
    }

    return fromRoomMetaItem(asRecord(response.Item));
  }

  async addMember(member: RoomMember): Promise<RoomMember> {
    const item = toRoomMemberItem(member);

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.getRequiredTableName(),
          Item: item,
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
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
    let response;

    try {
      response = await this.documentClient.send(
        new GetCommand({
          TableName: this.getRequiredTableName(),
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
    let response;

    try {
      response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.getRequiredTableName(),
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

    return members;
  }

  async countMembers(roomId: string): Promise<number> {
    let response;

    try {
      response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.getRequiredTableName(),
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
    const item = toRoomInviteItem(invite);

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.getRequiredTableName(),
          Item: item,
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('createInvite', error);
    }

    return invite;
  }

  async getInviteByCode(inviteCode: string): Promise<RoomInvite | null> {
    let response;

    try {
      response = await this.documentClient.send(
        new ScanCommand({
          TableName: this.getRequiredTableName(),
          FilterExpression: '#entityType = :entityType AND inviteCode = :inviteCode',
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

  private toInfrastructureException(
    operation: string,
    error: unknown,
  ): Error {
    const errorName = getErrorName(error);

    if (errorName === 'CredentialsProviderError') {
      return new ServiceUnavailableException(
        'DynamoDB credentials are missing. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (optionally AWS_SESSION_TOKEN) in env, or configure an AWS profile and run aws sso login.',
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
