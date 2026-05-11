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

import { getErrorName } from '../../../common/aws/aws-errors';
import {
  requireDynamoDbTableNames,
  type DynamoDbTableNameKey,
} from '../../../common/dynamodb/dynamodb-table-names';
import type { Highlight } from '../entities/highlight.entity';
import {
  fromHighlightItem,
  toHighlightItem,
} from '../mappers/highlights-dynamodb.mapper';
import type {
  HighlightsRepository,
  UpdateHighlightInput,
} from './highlights.repository';

const HIGHLIGHT_ID_INDEX_NAME = 'highlight-id-index';
const CREATOR_HIGHLIGHTS_INDEX_NAME = 'creator-highlights-index';

@Injectable()
export class DynamoDBHighlightsRepository implements HighlightsRepository {
  private readonly logger = new Logger(DynamoDBHighlightsRepository.name);
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

    this.tables = requireDynamoDbTableNames(
      this.configService,
      ['highlights'],
      DynamoDBHighlightsRepository.name,
    );

    this.logger.log(
      [
        'driver=dynamodb initialized',
        `region=${this.region}`,
        `highlightsTable=${this.tables.highlights}`,
        `profile=${this.profile ?? '(none)'}`,
        `endpoint=${this.endpoint ?? '(aws-default)'}`,
        `hasStaticCredentials=${this.hasStaticCredentials}`,
      ].join(' '),
    );
  }

  async createHighlight(highlight: Highlight): Promise<Highlight> {
    this.logger.log(
      `createHighlight roomId=${highlight.roomId} highlightId=${highlight.highlightId}`,
    );

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tables.highlights,
          Item: toHighlightItem(highlight),
          ConditionExpression:
            'attribute_not_exists(roomId) AND attribute_not_exists(createdAtHighlightId)',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('createHighlight', error);
    }

    return highlight;
  }

  async listHighlightsByRoomId(roomId: string): Promise<Highlight[]> {
    this.logger.log(
      `listHighlightsByRoomId roomId=${roomId} table=${this.tables.highlights}`,
    );
    const highlights: Highlight[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    try {
      do {
        const response = await this.documentClient.send(
          new QueryCommand({
            TableName: this.tables.highlights,
            KeyConditionExpression: 'roomId = :roomId',
            ExpressionAttributeValues: {
              ':roomId': roomId,
            },
            ScanIndexForward: false,
            ...(lastEvaluatedKey
              ? { ExclusiveStartKey: lastEvaluatedKey }
              : {}),
          }),
        );

        highlights.push(
          ...(response.Items ?? [])
            .map((item) => fromHighlightItem(asRecord(item)))
            .filter((highlight): highlight is Highlight => highlight !== null),
        );
        lastEvaluatedKey = asRecord(response.LastEvaluatedKey);
      } while (lastEvaluatedKey);
    } catch (error) {
      throw this.toInfrastructureException('listHighlightsByRoomId', error);
    }

    return highlights;
  }

  async getHighlightById(highlightId: string): Promise<Highlight | null> {
    this.logger.log(`getHighlightById highlightId=${highlightId}`);
    let response;

    try {
      response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tables.highlights,
          IndexName: HIGHLIGHT_ID_INDEX_NAME,
          KeyConditionExpression: 'highlightId = :highlightId',
          ExpressionAttributeValues: {
            ':highlightId': highlightId,
          },
          Limit: 1,
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('getHighlightById', error);
    }

    return fromHighlightItem(asRecord(response.Items?.[0]));
  }

  async findByCreatorUserId(userId: string): Promise<Highlight[]> {
    this.logger.log(`findByCreatorUserId userId=${userId}`);
    const highlights: Highlight[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    try {
      do {
        const response = await this.documentClient.send(
          new QueryCommand({
            TableName: this.tables.highlights,
            IndexName: CREATOR_HIGHLIGHTS_INDEX_NAME,
            KeyConditionExpression: 'createdByUserId = :userId',
            ExpressionAttributeValues: {
              ':userId': userId,
            },
            ScanIndexForward: false,
            ...(lastEvaluatedKey
              ? { ExclusiveStartKey: lastEvaluatedKey }
              : {}),
          }),
        );

        highlights.push(
          ...(response.Items ?? [])
            .map((item) => fromHighlightItem(asRecord(item)))
            .filter((highlight): highlight is Highlight => highlight !== null),
        );
        lastEvaluatedKey = asRecord(response.LastEvaluatedKey);
      } while (lastEvaluatedKey);
    } catch (error) {
      throw this.toInfrastructureException('findByCreatorUserId', error);
    }

    return highlights;
  }

  async updateHighlight(input: UpdateHighlightInput): Promise<Highlight> {
    this.logger.log(`updateHighlight highlightId=${input.highlightId}`);
    const existing = await this.getHighlightById(input.highlightId);

    if (!existing) {
      throw new Error(`Highlight ${input.highlightId} does not exist`);
    }

    const expressionAttributeNames: Record<string, string> = {
      '#updatedAt': 'updatedAt',
    };
    const expressionAttributeValues: Record<string, unknown> = {
      ':updatedAt': input.updatedAt,
    };
    const setExpressions = ['#updatedAt = :updatedAt'];
    const removeExpressions: string[] = [];

    if (input.shouldUpdateTitle) {
      expressionAttributeNames['#title'] = 'title';

      if (input.title) {
        expressionAttributeValues[':title'] = input.title;
        setExpressions.push('#title = :title');
      } else {
        removeExpressions.push('#title');
      }
    }

    if (input.shouldUpdateNote) {
      expressionAttributeNames['#note'] = 'note';

      if (input.note) {
        expressionAttributeValues[':note'] = input.note;
        setExpressions.push('#note = :note');
      } else {
        removeExpressions.push('#note');
      }
    }

    const updateExpression = [
      `SET ${setExpressions.join(', ')}`,
      removeExpressions.length > 0
        ? `REMOVE ${removeExpressions.join(', ')}`
        : null,
    ]
      .filter((expression): expression is string => expression !== null)
      .join(' ');

    let response;

    try {
      response = await this.documentClient.send(
        new UpdateCommand({
          TableName: this.tables.highlights,
          Key: {
            roomId: existing.roomId,
            createdAtHighlightId: existing.createdAtHighlightId,
          },
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('updateHighlight', error);
    }

    const updated = fromHighlightItem(asRecord(response.Attributes));

    if (!updated) {
      throw new Error(`Highlight ${input.highlightId} update returned no item`);
    }

    return updated;
  }

  async deleteHighlight(highlight: Highlight): Promise<void> {
    this.logger.log(
      `deleteHighlight roomId=${highlight.roomId} highlightId=${highlight.highlightId}`,
    );

    try {
      await this.documentClient.send(
        new DeleteCommand({
          TableName: this.tables.highlights,
          Key: {
            roomId: highlight.roomId,
            createdAtHighlightId: highlight.createdAtHighlightId,
          },
        }),
      );
    } catch (error) {
      throw this.toInfrastructureException('deleteHighlight', error);
    }
  }

  private toInfrastructureException(operation: string, error: unknown): Error {
    const errorName = getErrorName(error);
    const tableName = this.tables.highlights;

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
        `DynamoDB table "${tableName}" or a highlights index was not found in region "${this.region}".`,
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return value as Record<string, unknown>;
}
