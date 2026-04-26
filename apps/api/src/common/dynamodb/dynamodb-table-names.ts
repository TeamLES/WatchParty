import {
  InternalServerErrorException,
  type LoggerService,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DYNAMODB_TABLE_ENV_KEYS = {
  users: 'DDB_USERS_TABLE',
  rooms: 'DDB_ROOMS_TABLE',
  roomMembers: 'DDB_ROOM_MEMBERS_TABLE',
  invites: 'DDB_INVITES_TABLE',
  chatMessages: 'DDB_CHAT_MESSAGES_TABLE',
  wsConnections: 'DDB_WS_CONNECTIONS_TABLE',
  playbackSnapshots: 'DDB_PLAYBACK_SNAPSHOTS_TABLE',
  reactionEvents: 'DDB_REACTION_EVENTS_TABLE',
  scheduledParties: 'DDB_SCHEDULED_PARTIES_TABLE',
  idempotencyEvents: 'DDB_IDEMPOTENCY_EVENTS_TABLE',
} as const;

export type DynamoDbTableNameKey = keyof typeof DYNAMODB_TABLE_ENV_KEYS;

export type DynamoDbTableNames = Record<DynamoDbTableNameKey, string | null>;

export function resolveDynamoDbTableNames(
  configService: ConfigService,
): DynamoDbTableNames {
  return {
    users: readEnv(configService, DYNAMODB_TABLE_ENV_KEYS.users),
    rooms: readEnv(configService, DYNAMODB_TABLE_ENV_KEYS.rooms),
    roomMembers: readEnv(configService, DYNAMODB_TABLE_ENV_KEYS.roomMembers),
    invites: readEnv(configService, DYNAMODB_TABLE_ENV_KEYS.invites),
    chatMessages: readEnv(configService, DYNAMODB_TABLE_ENV_KEYS.chatMessages),
    wsConnections: readEnv(
      configService,
      DYNAMODB_TABLE_ENV_KEYS.wsConnections,
    ),
    playbackSnapshots: readEnv(
      configService,
      DYNAMODB_TABLE_ENV_KEYS.playbackSnapshots,
    ),
    reactionEvents: readEnv(
      configService,
      DYNAMODB_TABLE_ENV_KEYS.reactionEvents,
    ),
    scheduledParties: readEnv(
      configService,
      DYNAMODB_TABLE_ENV_KEYS.scheduledParties,
    ),
    idempotencyEvents: readEnv(
      configService,
      DYNAMODB_TABLE_ENV_KEYS.idempotencyEvents,
    ),
  };
}

export function requireDynamoDbTableNames(
  configService: ConfigService,
  keys: DynamoDbTableNameKey[],
  repositoryName: string,
): Record<DynamoDbTableNameKey, string> {
  const all = resolveDynamoDbTableNames(configService);
  const missingKeys = keys.filter((key) => !all[key]);

  if (missingKeys.length > 0) {
    const missingEnv = missingKeys.map((key) => DYNAMODB_TABLE_ENV_KEYS[key]);
    throw new InternalServerErrorException(
      `${repositoryName} requires ${missingEnv.join(', ')} for DynamoDB-backed repositories`,
    );
  }

  return keys.reduce(
    (accumulator, key) => {
      accumulator[key] = all[key] as string;
      return accumulator;
    },
    {} as Record<DynamoDbTableNameKey, string>,
  );
}

export function logDynamoDbTables(
  logger: LoggerService,
  tableNames: DynamoDbTableNames,
): void {
  logger.log(
    [
      'dynamoTables=',
      `users:${tableNames.users ?? '(unset)'}`,
      `rooms:${tableNames.rooms ?? '(unset)'}`,
      `roomMembers:${tableNames.roomMembers ?? '(unset)'}`,
      `invites:${tableNames.invites ?? '(unset)'}`,
      `chatMessages:${tableNames.chatMessages ?? '(unset)'}`,
      `wsConnections:${tableNames.wsConnections ?? '(unset)'}`,
      `playbackSnapshots:${tableNames.playbackSnapshots ?? '(unset)'}`,
      `reactionEvents:${tableNames.reactionEvents ?? '(unset)'}`,
      `scheduledParties:${tableNames.scheduledParties ?? '(unset)'}`,
      `idempotencyEvents:${tableNames.idempotencyEvents ?? '(unset)'}`,
    ].join(' '),
  );
}

function readEnv(configService: ConfigService, key: string): string | null {
  const value = configService.get<string>(key);

  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
