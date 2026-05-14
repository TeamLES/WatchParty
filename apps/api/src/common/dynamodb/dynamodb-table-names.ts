import {
  InternalServerErrorException,
  type LoggerService,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DYNAMODB_TABLE_ENV_KEYS = {
  rooms: 'DDB_ROOMS_TABLE',
  roomMembers: 'DDB_ROOM_MEMBERS_TABLE',
  invites: 'DDB_INVITES_TABLE',
  highlights: 'DDB_HIGHLIGHTS_TABLE',
  wsConnections: 'DDB_WS_CONNECTIONS_TABLE',
  playbackSnapshots: 'DDB_PLAYBACK_SNAPSHOTS_TABLE',
} as const;

export type DynamoDbTableNameKey = keyof typeof DYNAMODB_TABLE_ENV_KEYS;

export type DynamoDbTableNames = Record<DynamoDbTableNameKey, string | null>;

export function resolveDynamoDbTableNames(
  configService: ConfigService,
): DynamoDbTableNames {
  return {
    rooms: readEnv(configService, DYNAMODB_TABLE_ENV_KEYS.rooms),
    roomMembers: readEnv(configService, DYNAMODB_TABLE_ENV_KEYS.roomMembers),
    invites: readEnv(configService, DYNAMODB_TABLE_ENV_KEYS.invites),
    highlights: readEnv(configService, DYNAMODB_TABLE_ENV_KEYS.highlights),
    wsConnections: readEnv(
      configService,
      DYNAMODB_TABLE_ENV_KEYS.wsConnections,
    ),
    playbackSnapshots: readEnv(
      configService,
      DYNAMODB_TABLE_ENV_KEYS.playbackSnapshots,
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
      `rooms:${tableNames.rooms ?? '(unset)'}`,
      `roomMembers:${tableNames.roomMembers ?? '(unset)'}`,
      `invites:${tableNames.invites ?? '(unset)'}`,
      `highlights:${tableNames.highlights ?? '(unset)'}`,
      `wsConnections:${tableNames.wsConnections ?? '(unset)'}`,
      `playbackSnapshots:${tableNames.playbackSnapshots ?? '(unset)'}`,
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
