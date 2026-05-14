import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DYNAMODB_TABLE_ENV_KEYS } from '../../common/dynamodb/dynamodb-table-names';

const DEFAULT_WS_CONNECTIONS_TABLE = 'websocket-connections';

@Injectable()
export class RealtimePresenceService {
  private readonly logger = new Logger(RealtimePresenceService.name);
  private readonly documentClient: DynamoDBDocumentClient | null;
  private readonly tableName: string | null;

  constructor(private readonly configService: ConfigService) {
    this.tableName =
      this.configService
        .get<string>(DYNAMODB_TABLE_ENV_KEYS.wsConnections)
        ?.trim() ||
      this.configService.get<string>('WS_CONNECTIONS_TABLE')?.trim() ||
      DEFAULT_WS_CONNECTIONS_TABLE;

    const region =
      this.configService.get<string>('AWS_REGION')?.trim() ?? 'eu-central-1';
    const endpoint = this.configService.get<string>('DYNAMODB_ENDPOINT');

    this.documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region,
        ...(endpoint ? { endpoint } : {}),
      }),
      {
        marshallOptions: {
          removeUndefinedValues: true,
        },
      },
    );

    this.logger.log(`wsConnectionsTable=${this.tableName}`);
  }

  async countOnlineByRoom(roomId: string): Promise<number | null> {
    if (!this.documentClient || !this.tableName) {
      return null;
    }

    try {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'room-index',
          KeyConditionExpression: 'roomId = :roomId',
          ExpressionAttributeValues: {
            ':roomId': roomId,
          },
          Select: 'COUNT',
        }),
      );

      return response.Count ?? 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `countOnlineByRoom failed roomId=${roomId} error=${message}`,
      );
      return null;
    }
  }

  async listOnlineUserIdsByRoom(roomId: string): Promise<Set<string> | null> {
    if (!this.documentClient || !this.tableName) {
      return null;
    }

    try {
      const userIds = new Set<string>();
      let lastEvaluatedKey: Record<string, unknown> | undefined;

      do {
        const response = await this.documentClient.send(
          new QueryCommand({
            TableName: this.tableName,
            IndexName: 'room-index',
            KeyConditionExpression: 'roomId = :roomId',
            ExpressionAttributeValues: {
              ':roomId': roomId,
            },
            ProjectionExpression: 'userId',
            ExclusiveStartKey: lastEvaluatedKey,
          }),
        );

        for (const item of response.Items ?? []) {
          const userId =
            typeof item.userId === 'string' && item.userId.length > 0
              ? item.userId
              : null;

          if (userId) {
            userIds.add(userId);
          }
        }

        lastEvaluatedKey = response.LastEvaluatedKey as
          | Record<string, unknown>
          | undefined;
      } while (lastEvaluatedKey);

      return userIds;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `listOnlineUserIdsByRoom failed roomId=${roomId} error=${message}`,
      );
      return null;
    }
  }

  async broadcastToRoom(roomId: string, payload: unknown): Promise<void> {
    this.logger.debug(
      `broadcastToRoom skipped roomId=${roomId} payloadType=${typeof payload}`,
    );
  }
}
