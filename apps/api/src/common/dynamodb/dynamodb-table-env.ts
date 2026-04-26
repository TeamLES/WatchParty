export const DYNAMODB_TABLE_ENV = {
  users: 'DDB_USERS_TABLE',
  rooms: 'DDB_ROOMS_TABLE',
  roomMembers: 'DDB_ROOM_MEMBERS_TABLE',
  invites: 'DDB_INVITES_TABLE',
  chatMessages: 'DDB_CHAT_MESSAGES_TABLE',
  websocketConnections: 'DDB_WS_CONNECTIONS_TABLE',
  playbackSnapshots: 'DDB_PLAYBACK_SNAPSHOTS_TABLE',
  reactionEvents: 'DDB_REACTION_EVENTS_TABLE',
  scheduledParties: 'DDB_SCHEDULED_PARTIES_TABLE',
  idempotencyEvents: 'DDB_IDEMPOTENCY_EVENTS_TABLE',
} as const;

export type DynamoDbTableKey = keyof typeof DYNAMODB_TABLE_ENV;
