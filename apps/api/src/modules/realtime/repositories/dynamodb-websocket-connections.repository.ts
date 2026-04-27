import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { WebSocketConnection } from '@watchparty/shared-types/tables';

import { getErrorName } from '../../../common/aws/aws-errors';
import { requireDynamoDbTableNames } from '../../../common/dynamodb/dynamodb-table-names';

export type WebsocketConnectionRecord = WebSocketConnection;

@Injectable()
export class DynamoDbWebsocketConnectionsRepository {
  private readonly logger = new Logger(
    DynamoDbWebsocketConnectionsRepository.name,
  );
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly region: string;
  private readonly tableName: string;

  constructor(private readonly configService: ConfigService) {
    this.region =
      this.configService.get<string>('AWS_REGION')?.trim() ?? 'eu-central-1';
    const endpoint = this.configService.get<string>('DYNAMODB_ENDPOINT');

    this.documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: this.region,
        ...(endpoint ? { endpoint } : {}),
      }),
      {
        marshallOptions: {
          removeUndefinedValues: true,
        },
      },
    );

    this.tableName = requireDynamoDbTableNames(
      this.configService,
      ['wsConnections'],
      DynamoDbWebsocketConnectionsRepository.name,
    ).wsConnections;

    this.logger.log(
      `driver=dynamodb initialized region=${this.region} wsConnectionsTable=${this.tableName}`,
    );
    // TODO: This repository is intended for API Gateway WebSocket lifecycle and room broadcast fanout.
  }

  async putConnection(
    connection: WebsocketConnectionRecord,
  ): Promise<WebsocketConnectionRecord> {
    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: connection,
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('putConnection', error);
    }

    return connection;
  }

  async attachConnectionToRoom(
    connectionId: string,
    roomId: string,
  ): Promise<void> {
    try {
      await this.documentClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { connectionId },
          UpdateExpression: 'SET roomId = :roomId',
          ExpressionAttributeValues: {
            ':roomId': roomId,
          },
          ConditionExpression: 'attribute_exists(connectionId)',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('attachConnectionToRoom', error);
    }
  }

  async updateHeartbeat(
    connectionId: string,
    lastSeenAt: string,
    expiresAt: number,
  ): Promise<void> {
    try {
      await this.documentClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { connectionId },
          UpdateExpression:
            'SET lastSeenAt = :lastSeenAt, expiresAt = :expiresAt',
          ExpressionAttributeValues: {
            ':lastSeenAt': lastSeenAt,
            ':expiresAt': expiresAt,
          },
          ConditionExpression: 'attribute_exists(connectionId)',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('updateHeartbeat', error);
    }
  }

  async removeConnection(connectionId: string): Promise<void> {
    try {
      await this.documentClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { connectionId },
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('removeConnection', error);
    }
  }

  async listConnectionsByRoom(
    roomId: string,
  ): Promise<WebsocketConnectionRecord[]> {
    try {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'room-index',
          KeyConditionExpression: 'roomId = :roomId',
          ExpressionAttributeValues: {
            ':roomId': roomId,
          },
          ScanIndexForward: false,
        }),
      );

      return (response.Items ?? []) as WebsocketConnectionRecord[];
    } catch (error) {
      throw this.toInfrastructureException('listConnectionsByRoom', error);
    }
  }

  async listConnectionsByUser(
    userId: string,
  ): Promise<WebsocketConnectionRecord[]> {
    try {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'user-index',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
          ScanIndexForward: false,
        }),
      );

      return (response.Items ?? []) as WebsocketConnectionRecord[];
    } catch (error) {
      throw this.toInfrastructureException('listConnectionsByUser', error);
    }
  }

  private toInfrastructureException(operation: string, error: unknown): Error {
    const errorName = getErrorName(error);

    if (errorName === 'ResourceNotFoundException') {
      return new ServiceUnavailableException(
        `DynamoDB table "${this.tableName}" was not found in region "${this.region}".`,
      );
    }

    return error instanceof Error
      ? error
      : new ServiceUnavailableException(
        `DynamoDB request failed during ${operation}.`,
      );
  }
}
