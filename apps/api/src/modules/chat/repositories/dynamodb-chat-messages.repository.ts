import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
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

import { requireDynamoDbTableNames } from '../../../common/dynamodb/dynamodb-table-names';
import type { ChatMessage } from '../entities/chat-message.entity';

@Injectable()
export class DynamoDbChatMessagesRepository {
  private readonly logger = new Logger(DynamoDbChatMessagesRepository.name);
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
      ['chatMessages'],
      DynamoDbChatMessagesRepository.name,
    ).chatMessages;

    this.logger.log(
      `driver=dynamodb initialized region=${this.region} chatMessagesTable=${this.tableName}`,
    );
  }

  async createMessage(message: ChatMessage): Promise<ChatMessage> {
    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: message,
          ConditionExpression:
            'attribute_not_exists(roomId) AND attribute_not_exists(sentAtMessageId)',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('createMessage', error);
    }

    return message;
  }

  async listMessagesByRoom(roomId: string, limit = 50): Promise<ChatMessage[]> {
    try {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'roomId = :roomId',
          ExpressionAttributeValues: {
            ':roomId': roomId,
          },
          ScanIndexForward: false,
          Limit: limit,
        }),
      );

      return (response.Items ?? []) as ChatMessage[];
    } catch (error) {
      throw this.toInfrastructureException('listMessagesByRoom', error);
    }
  }

  async softDeleteMessage(
    roomId: string,
    sentAtMessageId: string,
  ): Promise<void> {
    try {
      await this.documentClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            roomId,
            sentAtMessageId,
          },
          UpdateExpression: 'SET deletedAt = :deletedAt',
          ExpressionAttributeValues: {
            ':deletedAt': new Date().toISOString(),
          },
          ConditionExpression:
            'attribute_exists(roomId) AND attribute_exists(sentAtMessageId)',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('softDeleteMessage', error);
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

function getErrorName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('name' in error)) {
    return undefined;
  }

  const value = (error as { name: unknown }).name;
  return typeof value === 'string' ? value : undefined;
}
