import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from "aws-lambda";

type PlaybackState = "playing" | "paused";
type PlaybackEventKind = "play" | "pause" | "seek" | "position";

interface JoinRoomMessage {
  action: "joinRoom";
  roomId: string;
}

interface LeaveRoomMessage {
  action: "leaveRoom";
}

interface SyncPlaybackMessage {
  action: "syncPlayback";
  roomId: string;
  videoId?: string;
  sequence: number;
  eventType: PlaybackEventKind;
  state: PlaybackState;
  positionMs: number;
  eventId: string;
  sentAt: string;
}

interface GetPlaybackSnapshotMessage {
  action: "getPlaybackSnapshot";
  roomId: string;
}

interface PingMessage {
  action: "ping";
}

interface ChatMessageReceived {
  action: "chatMessage";
  roomId: string;
  text: string;
  messageId?: string;
  sentAt?: string;
}

interface ReactionMessage {
  action: "reaction";
  roomId: string;
  emoji: string;
}

type InboundMessage =
  | JoinRoomMessage
  | LeaveRoomMessage
  | SyncPlaybackMessage
  | GetPlaybackSnapshotMessage
  | ChatMessageReceived
  | ReactionMessage
  | PingMessage
  | Record<string, unknown>;

interface ConnectionRecord {
  connectionId: string;
  userId: string;
  roomId?: string;
  connectedAt: string;
  lastSeenAt: string;
  expiresAt: number;
}

type RoomMemberRole = "host" | "co-host" | "viewer";

interface RoomRecord {
  roomId: string;
  hostUserId: string;
  coHostUserId?: string | null;
  activeWatcherCount?: number;
}

interface RoomMemberRecord {
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  nickname?: string;
}

interface PlaybackSnapshotRecord {
  roomId: string;
  videoId?: string;
  sequence: number;
  eventType: PlaybackEventKind;
  state: PlaybackState;
  positionMs: number;
  updatedByUserId: string;
  updatedAt: string;
  eventId: string;
  sentAt: string;
}

interface WebSocketAuthorizerEvent {
  methodArn: string;
  queryStringParameters?: Record<string, string | undefined>;
}

interface TicketPayload {
  sub: string;
  iat: number;
  exp: number;
  nonce: string;
}

const region = process.env.AWS_REGION ?? "eu-central-1";
const wsConnectionsTable =
  process.env.DDB_WS_CONNECTIONS_TABLE ??
  process.env.WS_CONNECTIONS_TABLE ??
  "websocket-connections";
const playbackSnapshotsTable =
  process.env.DDB_PLAYBACK_SNAPSHOTS_TABLE ??
  process.env.PLAYBACK_SNAPSHOTS_TABLE ??
  "playback-snapshots";
const roomsTable =
  process.env.DDB_ROOMS_TABLE ?? process.env.ROOMS_TABLE ?? "rooms";
const roomMembersTable =
  process.env.DDB_ROOM_MEMBERS_TABLE ??
  process.env.ROOM_MEMBERS_TABLE ??
  "room-members";
const connectionTtlSeconds = Math.max(
  Number(process.env.CONNECTION_TTL_SECONDS ?? "7200"),
  60,
);
const useCustomDomain = process.env.WS_CUSTOM_DOMAIN === "true";
const allowUnauthenticated = process.env.ALLOW_UNAUTHENTICATED_WS === "true";

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region }),
  { marshallOptions: { removeUndefinedValues: true } },
);

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}

function parseBody(event: APIGatewayProxyWebsocketEventV2): InboundMessage {
  if (!event.body) {
    return {};
  }

  try {
    return JSON.parse(event.body) as InboundMessage;
  } catch {
    return {};
  }
}

function getWsEndpoint(event: APIGatewayProxyWebsocketEventV2): string {
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  return useCustomDomain ? `https://${domain}` : `https://${domain}/${stage}`;
}

function wsClient(
  event: APIGatewayProxyWebsocketEventV2,
): ApiGatewayManagementApiClient {
  return new ApiGatewayManagementApiClient({ endpoint: getWsEndpoint(event) });
}

function nowIso(): string {
  return new Date().toISOString();
}

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function senderUserId(event: APIGatewayProxyWebsocketEventV2): string | null {
  const requestContext = event.requestContext as typeof event.requestContext & {
    authorizer?: { userId?: unknown; principalId?: unknown };
  };
  const queryStringParameters = (
    event as APIGatewayProxyWebsocketEventV2 & {
      queryStringParameters?: Record<string, string | undefined>;
    }
  ).queryStringParameters;
  const authorizer = requestContext.authorizer as
    | { userId?: unknown; principalId?: unknown }
    | undefined;
  const authorizerUserId =
    readString(authorizer?.userId) ?? readString(authorizer?.principalId);

  if (authorizerUserId) {
    return authorizerUserId;
  }

  if (allowUnauthenticated) {
    return (
      readString(queryStringParameters?.userId) ??
      `guest-${event.requestContext.connectionId}`
    );
  }

  return null;
}

function isPlaybackState(value: unknown): value is PlaybackState {
  return value === "playing" || value === "paused";
}

function isPlaybackEventKind(value: unknown): value is PlaybackEventKind {
  return (
    value === "play" ||
    value === "pause" ||
    value === "seek" ||
    value === "position"
  );
}

function isGoneError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
    statusCode?: number;
  };

  return (
    maybeError.name === "GoneException" ||
    maybeError.$metadata?.httpStatusCode === 410 ||
    maybeError.statusCode === 410
  );
}

function isConditionalCheckFailed(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "ConditionalCheckFailedException"
  );
}

function isTransactionCanceled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "TransactionCanceledException"
  );
}

function validateRoomId(roomId: unknown): string | null {
  const value = readString(roomId);
  if (!value || !/^[a-z0-9]{16}$/i.test(value)) {
    return null;
  }

  return value;
}

function validateSyncPayload(
  body: Partial<SyncPlaybackMessage>,
): SyncPlaybackMessage | null {
  const roomId = validateRoomId(body.roomId);
  const eventId = readString(body.eventId);
  const videoId = readString(body.videoId) ?? undefined;
  const sentAt = readString(body.sentAt) ?? nowIso();

  if (
    !roomId ||
    !Number.isSafeInteger(body.sequence) ||
    body.sequence < 1 ||
    !isPlaybackEventKind(body.eventType) ||
    !isPlaybackState(body.state) ||
    typeof body.positionMs !== "number" ||
    !Number.isFinite(body.positionMs) ||
    body.positionMs < 0 ||
    !eventId
  ) {
    return null;
  }

  return {
    action: "syncPlayback",
    roomId,
    ...(videoId ? { videoId } : {}),
    sequence: body.sequence,
    eventType: body.eventType,
    state: body.state,
    positionMs: Math.round(body.positionMs),
    eventId,
    sentAt,
  };
}

async function getConnection(
  connectionId: string,
): Promise<ConnectionRecord | null> {
  const response = await ddbDocClient.send(
    new GetCommand({
      TableName: wsConnectionsTable,
      Key: { connectionId },
    }),
  );

  return (response.Item ?? null) as ConnectionRecord | null;
}

async function getRoom(roomId: string): Promise<RoomRecord | null> {
  const response = await ddbDocClient.send(
    new GetCommand({
      TableName: roomsTable,
      Key: { roomId },
    }),
  );

  return (response.Item ?? null) as RoomRecord | null;
}

async function listRoomMembers(roomId: string): Promise<RoomMemberRecord[]> {
  const members: RoomMemberRecord[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await ddbDocClient.send(
      new QueryCommand({
        TableName: roomMembersTable,
        KeyConditionExpression: "roomId = :roomId",
        ExpressionAttributeValues: {
          ":roomId": roomId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    members.push(...((response.Items ?? []) as RoomMemberRecord[]));
    lastEvaluatedKey = response.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (lastEvaluatedKey);

  return members;
}

async function updateRoomCoHost(
  roomId: string,
  coHostUserId: string | null,
): Promise<void> {
  if (coHostUserId) {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: roomsTable,
        Key: { roomId },
        UpdateExpression: "SET coHostUserId = :coHostUserId",
        ConditionExpression: "attribute_exists(roomId)",
        ExpressionAttributeValues: {
          ":coHostUserId": coHostUserId,
        },
      }),
    );
    return;
  }

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: roomsTable,
      Key: { roomId },
      UpdateExpression: "REMOVE coHostUserId",
      ConditionExpression: "attribute_exists(roomId)",
    }),
  );
}

async function updateMemberRole(
  roomId: string,
  userId: string,
  role: RoomMemberRole,
): Promise<void> {
  try {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: roomMembersTable,
        Key: { roomId, userId },
        UpdateExpression: "SET #role = :role",
        ConditionExpression:
          "attribute_exists(roomId) AND attribute_exists(userId)",
        ExpressionAttributeNames: {
          "#role": "role",
        },
        ExpressionAttributeValues: {
          ":role": role,
        },
      }),
    );
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      return;
    }

    throw error;
  }
}

async function getLatestSnapshot(
  roomId: string,
): Promise<PlaybackSnapshotRecord | null> {
  const response = await ddbDocClient.send(
    new QueryCommand({
      TableName: playbackSnapshotsTable,
      KeyConditionExpression: "roomId = :roomId",
      ExpressionAttributeValues: {
        ":roomId": roomId,
      },
      ScanIndexForward: false,
      Limit: 1,
    }),
  );

  return (response.Items?.[0] ?? null) as PlaybackSnapshotRecord | null;
}

async function hasPlaybackEventId(
  roomId: string,
  eventId: string,
): Promise<boolean> {
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await ddbDocClient.send(
      new QueryCommand({
        TableName: playbackSnapshotsTable,
        KeyConditionExpression: "roomId = :roomId",
        FilterExpression: "eventId = :eventId",
        ExpressionAttributeValues: {
          ":roomId": roomId,
          ":eventId": eventId,
        },
        ProjectionExpression: "eventId",
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    if ((response.Items ?? []).length > 0) {
      return true;
    }

    lastEvaluatedKey = response.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (lastEvaluatedKey);

  return false;
}

async function listConnectionsByRoom(
  roomId: string,
): Promise<ConnectionRecord[]> {
  const connections: ConnectionRecord[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await ddbDocClient.send(
      new QueryCommand({
        TableName: wsConnectionsTable,
        IndexName: "room-index",
        KeyConditionExpression: "roomId = :roomId",
        ExpressionAttributeValues: {
          ":roomId": roomId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    connections.push(...((response.Items ?? []) as ConnectionRecord[]));
    lastEvaluatedKey = response.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (lastEvaluatedKey);

  return connections;
}

async function hasOtherRoomConnection(
  roomId: string,
  userId: string,
  connectionId: string,
): Promise<boolean> {
  const connections = await listConnectionsByRoom(roomId);

  return connections.some(
    (connection) =>
      connection.connectionId !== connectionId && connection.userId === userId,
  );
}

function resolveMemberRole(
  hostUserId: string,
  coHostUserId: string | null,
  memberUserId: string,
): RoomMemberRole {
  if (memberUserId === hostUserId) {
    return "host";
  }

  if (coHostUserId && memberUserId === coHostUserId) {
    return "co-host";
  }

  return "viewer";
}

async function normalizeMemberRoles(
  room: RoomRecord,
  members: RoomMemberRecord[],
  coHostUserId: string | null,
): Promise<boolean> {
  let changed = false;

  await Promise.all(
    members.map(async (member) => {
      const nextRole = resolveMemberRole(
        room.hostUserId,
        coHostUserId,
        member.userId,
      );

      if (member.role === nextRole) {
        return;
      }

      changed = true;
      await updateMemberRole(member.roomId, member.userId, nextRole);
      member.role = nextRole;
    }),
  );

  return changed;
}

function toRoomMemberResponse(member: RoomMemberRecord) {
  return {
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt,
    nickname: member.nickname ?? null,
  };
}

async function ensureRoomHasController(roomId: string): Promise<{
  room: RoomRecord | null;
  members: RoomMemberRecord[];
  changed: boolean;
}> {
  const [room, members, connections] = await Promise.all([
    getRoom(roomId),
    listRoomMembers(roomId),
    listConnectionsByRoom(roomId),
  ]);

  if (!room) {
    return { room, members: [], changed: false };
  }

  const onlineUserIds = new Set(
    connections.map((connection) => connection.userId),
  );
  const onlineMembers = members.filter((member) =>
    onlineUserIds.has(member.userId),
  );

  if (onlineMembers.length === 0) {
    const changed = Boolean(room.coHostUserId);
    if (changed) {
      await updateRoomCoHost(roomId, null);
      room.coHostUserId = null;
    }
    const rolesChanged = await normalizeMemberRoles(room, members, null);
    return { room, members, changed: changed || rolesChanged };
  }

  const hostOnline = onlineMembers.some(
    (member) => member.userId === room.hostUserId,
  );
  const coHostUserId = room.coHostUserId ?? null;
  const coHostOnline =
    coHostUserId !== null &&
    onlineMembers.some((member) => member.userId === coHostUserId);

  if (hostOnline || coHostOnline) {
    const changed = await normalizeMemberRoles(room, members, coHostUserId);
    return { room, members, changed };
  }

  const eligibleMembers = onlineMembers.filter(
    (member) => member.userId !== room.hostUserId && member.role !== "host",
  );
  const nextCoHost =
    eligibleMembers.length > 0
      ? eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)]
      : null;
  const nextCoHostUserId = nextCoHost?.userId ?? null;
  const changed = coHostUserId !== nextCoHostUserId;

  if (changed) {
    await updateRoomCoHost(roomId, nextCoHostUserId);
    room.coHostUserId = nextCoHostUserId;
  }

  const rolesChanged = await normalizeMemberRoles(
    room,
    members,
    nextCoHostUserId,
  );

  return { room, members, changed: changed || rolesChanged };
}

async function broadcastRoomRoleUpdated(
  event: APIGatewayProxyWebsocketEventV2,
  roomId: string,
  room: RoomRecord,
  members: RoomMemberRecord[],
): Promise<void> {
  await broadcastToRoom(event, roomId, {
    type: "room_role_updated",
    roomId,
    hostUserId: room.hostUserId,
    coHostUserId: room.coHostUserId ?? null,
    members: members.map(toRoomMemberResponse),
    updatedAt: nowIso(),
  });
}

async function isRoomController(
  roomId: string,
  userId: string,
): Promise<{
  isController: boolean;
  room: RoomRecord | null;
  members: RoomMemberRecord[];
  rolesChanged: boolean;
}> {
  const ensured = await ensureRoomHasController(roomId);
  const currentMember = ensured.members.find(
    (member) => member.userId === userId,
  );
  const isController =
    ensured.room?.hostUserId === userId ||
    ensured.room?.coHostUserId === userId ||
    currentMember?.role === "host" ||
    currentMember?.role === "co-host";

  return {
    isController,
    room: ensured.room,
    members: ensured.members,
    rolesChanged: ensured.changed,
  };
}

async function releaseActiveWatcherSeat(
  roomId: string,
  userId: string,
): Promise<void> {
  try {
    await ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: roomMembersTable,
              Key: {
                roomId,
                userId,
              },
              ConditionExpression:
                "attribute_exists(roomId) AND attribute_exists(userId)",
            },
          },
          {
            Update: {
              TableName: roomsTable,
              Key: {
                roomId,
              },
              UpdateExpression:
                "SET activeWatcherCount = activeWatcherCount - :one",
              ConditionExpression:
                "attribute_exists(roomId) AND activeWatcherCount > :zero",
              ExpressionAttributeValues: {
                ":one": 1,
                ":zero": 0,
              },
            },
          },
        ],
      }),
    );
  } catch (error) {
    if (isTransactionCanceled(error)) {
      return;
    }

    throw error;
  }
}

async function pauseRoomPlaybackIfEmpty(
  roomId: string,
  userId: string,
): Promise<void> {
  const [room, latestSnapshot] = await Promise.all([
    getRoom(roomId),
    getLatestSnapshot(roomId),
  ]);
  const activeWatcherCount =
    typeof room?.activeWatcherCount === "number" ? room.activeWatcherCount : 0;

  if (
    activeWatcherCount > 0 ||
    !latestSnapshot ||
    latestSnapshot.state === "paused"
  ) {
    return;
  }

  const updatedAt = nowIso();
  const elapsedMs = Math.max(
    0,
    Date.now() - Date.parse(latestSnapshot.updatedAt),
  );
  const positionMs =
    latestSnapshot.state === "playing"
      ? latestSnapshot.positionMs + elapsedMs
      : latestSnapshot.positionMs;

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: playbackSnapshotsTable,
        Item: {
          roomId,
          ...(latestSnapshot.videoId
            ? { videoId: latestSnapshot.videoId }
            : {}),
          sequence: latestSnapshot.sequence + 1,
          eventType: "pause",
          state: "paused",
          positionMs,
          updatedByUserId: userId,
          updatedAt,
          eventId: randomUUID(),
          sentAt: updatedAt,
        } satisfies PlaybackSnapshotRecord,
        ConditionExpression:
          "attribute_not_exists(roomId) AND attribute_not_exists(#sequence)",
        ExpressionAttributeNames: {
          "#sequence": "sequence",
        },
      }),
    );
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      return;
    }

    throw error;
  }
}

async function sendToConnection(
  apiClient: ApiGatewayManagementApiClient,
  connectionId: string,
  payload: unknown,
): Promise<boolean> {
  try {
    await apiClient.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(payload)),
      }),
    );
    return true;
  } catch (error) {
    if (isGoneError(error)) {
      await ddbDocClient.send(
        new DeleteCommand({
          TableName: wsConnectionsTable,
          Key: { connectionId },
        }),
      );
      return false;
    }

    console.error("postToConnection failed", { connectionId, error });
    return false;
  }
}

async function broadcastToRoom(
  event: APIGatewayProxyWebsocketEventV2,
  roomId: string,
  payload: unknown,
  excludeConnectionId?: string,
): Promise<number> {
  const apiClient = wsClient(event);
  const connections = await listConnectionsByRoom(roomId);
  let delivered = 0;

  for (const connection of connections) {
    if (connection.connectionId === excludeConnectionId) {
      continue;
    }

    const didDeliver = await sendToConnection(
      apiClient,
      connection.connectionId,
      payload,
    );

    if (didDeliver) {
      delivered += 1;
    }
  }

  return delivered;
}

async function broadcastPresence(
  event: APIGatewayProxyWebsocketEventV2,
  roomId: string,
): Promise<void> {
  const connections = await listConnectionsByRoom(roomId);

  await broadcastToRoom(event, roomId, {
    type: "presence.updated",
    roomId,
    onlineCount: connections.length,
    updatedAt: nowIso(),
  });
}

function toSnapshotEvent(snapshot: PlaybackSnapshotRecord) {
  return {
    type: "playback.snapshot",
    roomId: snapshot.roomId,
    videoId: snapshot.videoId ?? null,
    sequence: snapshot.sequence,
    state: snapshot.state,
    positionMs: snapshot.positionMs,
    updatedByUserId: snapshot.updatedByUserId,
    updatedAt: snapshot.updatedAt,
    eventId: snapshot.eventId,
  };
}

function defaultSnapshot(roomId: string) {
  return {
    type: "playback.snapshot",
    roomId,
    videoId: null,
    sequence: 0,
    state: "paused",
    positionMs: 0,
    updatedByUserId: "system",
    updatedAt: nowIso(),
    eventId: "initial",
  };
}

async function onConnect(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;
  const userId = senderUserId(event);

  if (!userId) {
    return response(401, { message: "Unauthorized WebSocket connection" });
  }

  const connectedAt = nowIso();

  await ddbDocClient.send(
    new PutCommand({
      TableName: wsConnectionsTable,
      Item: {
        connectionId,
        userId,
        connectedAt,
        lastSeenAt: connectedAt,
        expiresAt: nowEpochSeconds() + connectionTtlSeconds,
      },
    }),
  );

  return response(200, { ok: true, route: "$connect" });
}

async function onDisconnect(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;
  const connection = await getConnection(connectionId);
  const shouldReleaseSeat =
    connection?.roomId && connection.userId
      ? !(await hasOtherRoomConnection(
          connection.roomId,
          connection.userId,
          connectionId,
        ))
      : false;

  await ddbDocClient.send(
    new DeleteCommand({
      TableName: wsConnectionsTable,
      Key: { connectionId },
    }),
  );

  if (connection?.roomId) {
    if (shouldReleaseSeat) {
      await releaseActiveWatcherSeat(connection.roomId, connection.userId);
      await pauseRoomPlaybackIfEmpty(connection.roomId, connection.userId);
    }

    const controllerState = await ensureRoomHasController(connection.roomId);
    if (controllerState.room && controllerState.changed) {
      await broadcastRoomRoleUpdated(
        event,
        connection.roomId,
        controllerState.room,
        controllerState.members,
      );
    }
    await broadcastPresence(event, connection.roomId);
  }

  return response(200, { ok: true, route: "$disconnect" });
}

async function onJoinRoom(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;
  const body = parseBody(event) as Partial<JoinRoomMessage>;
  const roomId = validateRoomId(body.roomId);

  if (!roomId) {
    return response(400, { message: "roomId is required" });
  }

  const room = await getRoom(roomId);
  if (!room) {
    return response(404, { message: "Room not found" });
  }

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: wsConnectionsTable,
      Key: { connectionId },
      UpdateExpression:
        "SET roomId = :roomId, lastSeenAt = :lastSeenAt, expiresAt = :expiresAt",
      ExpressionAttributeValues: {
        ":roomId": roomId,
        ":lastSeenAt": nowIso(),
        ":expiresAt": nowEpochSeconds() + connectionTtlSeconds,
      },
      ConditionExpression: "attribute_exists(connectionId)",
    }),
  );

  const latestSnapshot = await getLatestSnapshot(roomId);
  await sendToConnection(
    wsClient(event),
    connectionId,
    latestSnapshot ? toSnapshotEvent(latestSnapshot) : defaultSnapshot(roomId),
  );
  const controllerState = await ensureRoomHasController(roomId);
  if (controllerState.room && controllerState.changed) {
    await broadcastRoomRoleUpdated(
      event,
      roomId,
      controllerState.room,
      controllerState.members,
    );
  }
  await broadcastPresence(event, roomId);

  return response(200, { ok: true, route: "joinRoom" });
}

async function onLeaveRoom(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;
  const connection = await getConnection(connectionId);
  const shouldReleaseSeat =
    connection?.roomId && connection.userId
      ? !(await hasOtherRoomConnection(
          connection.roomId,
          connection.userId,
          connectionId,
        ))
      : false;

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: wsConnectionsTable,
      Key: { connectionId },
      UpdateExpression: "SET lastSeenAt = :lastSeenAt REMOVE roomId",
      ExpressionAttributeValues: {
        ":lastSeenAt": nowIso(),
      },
      ConditionExpression: "attribute_exists(connectionId)",
    }),
  );

  if (connection?.roomId) {
    if (shouldReleaseSeat) {
      await releaseActiveWatcherSeat(connection.roomId, connection.userId);
      await pauseRoomPlaybackIfEmpty(connection.roomId, connection.userId);
    }

    const controllerState = await ensureRoomHasController(connection.roomId);
    if (controllerState.room && controllerState.changed) {
      await broadcastRoomRoleUpdated(
        event,
        connection.roomId,
        controllerState.room,
        controllerState.members,
      );
    }
    await broadcastPresence(event, connection.roomId);
  }

  return response(200, { ok: true, route: "leaveRoom" });
}

async function onPing(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: wsConnectionsTable,
      Key: { connectionId },
      UpdateExpression: "SET lastSeenAt = :lastSeenAt, expiresAt = :expiresAt",
      ExpressionAttributeValues: {
        ":lastSeenAt": nowIso(),
        ":expiresAt": nowEpochSeconds() + connectionTtlSeconds,
      },
      ConditionExpression: "attribute_exists(connectionId)",
    }),
  );

  return response(200, { ok: true, route: "ping" });
}

async function onGetPlaybackSnapshot(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;
  const body = parseBody(event) as Partial<GetPlaybackSnapshotMessage>;
  const roomId = validateRoomId(body.roomId);

  if (!roomId) {
    return response(400, { message: "roomId is required" });
  }

  const latestSnapshot = await getLatestSnapshot(roomId);
  await sendToConnection(
    wsClient(event),
    connectionId,
    latestSnapshot ? toSnapshotEvent(latestSnapshot) : defaultSnapshot(roomId),
  );

  return response(200, { ok: true, route: "getPlaybackSnapshot" });
}

async function onSyncPlayback(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const msg = validateSyncPayload(
    parseBody(event) as Partial<SyncPlaybackMessage>,
  );
  const connectionId = event.requestContext.connectionId;
  const userId = senderUserId(event);

  if (!msg || !userId) {
    return response(400, { message: "Invalid syncPlayback payload" });
  }

  const connection = await getConnection(connectionId);

  if (connection?.roomId !== msg.roomId) {
    return response(403, { message: "Connection has not joined this room" });
  }

  const controllerCheck = await isRoomController(msg.roomId, userId);
  if (!controllerCheck.room) {
    return response(404, { message: "Room not found" });
  }

  if (controllerCheck.rolesChanged) {
    await broadcastRoomRoleUpdated(
      event,
      msg.roomId,
      controllerCheck.room,
      controllerCheck.members,
    );
  }

  if (!controllerCheck.isController) {
    return response(403, {
      message: "Only the room host or co-host can sync playback",
    });
  }

  if (await hasPlaybackEventId(msg.roomId, msg.eventId)) {
    return response(409, { message: "Duplicate playback event" });
  }

  const latestSnapshot = await getLatestSnapshot(msg.roomId);
  const nextSequence = Math.max(
    msg.sequence,
    (latestSnapshot?.sequence ?? 0) + 1,
  );
  const updatedAt = nowIso();
  const snapshot: PlaybackSnapshotRecord = {
    roomId: msg.roomId,
    ...(msg.videoId ? { videoId: msg.videoId } : {}),
    sequence: nextSequence,
    eventType: msg.eventType,
    state: msg.state,
    positionMs: msg.positionMs,
    updatedByUserId: userId,
    updatedAt,
    eventId: msg.eventId,
    sentAt: msg.sentAt,
  };

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: playbackSnapshotsTable,
        Item: snapshot,
        ConditionExpression:
          "attribute_not_exists(roomId) AND attribute_not_exists(#sequence)",
        ExpressionAttributeNames: {
          "#sequence": "sequence",
        },
      }),
    );
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      return response(409, { message: "Duplicate playback sequence" });
    }

    throw error;
  }

  const outboundPayload = {
    type: "playback.sync",
    roomId: snapshot.roomId,
    videoId: snapshot.videoId ?? null,
    sequence: snapshot.sequence,
    eventType: snapshot.eventType,
    state: snapshot.state,
    positionMs: snapshot.positionMs,
    updatedByUserId: snapshot.updatedByUserId,
    updatedAt: snapshot.updatedAt,
    eventId: snapshot.eventId,
    sentAt: snapshot.sentAt,
  };

  const delivered = await broadcastToRoom(event, msg.roomId, outboundPayload);

  return response(200, { ok: true, route: "syncPlayback", delivered });
}

async function onChatMessage(
  event: APIGatewayProxyWebsocketEventV2,
  userId: string | null,
  msg: ChatMessageReceived,
): Promise<APIGatewayProxyResultV2> {
  if (!userId) {
    return response(401, { message: "Unauthorized" });
  }

  const text = readString(msg.text);
  if (!text || text.length > 500) {
    return response(400, { message: "Invalid chat message" });
  }

  const currentConn = await getConnection(event.requestContext.connectionId);

  if (!currentConn?.roomId) {
    return response(403, { message: "Connection has not joined a room" });
  }

  if (msg.roomId && msg.roomId !== currentConn.roomId) {
    return response(403, { message: "Connection has not joined this room" });
  }

  const payload = {
    type: "chat.message",
    roomId: currentConn.roomId,
    text,
    messageId: randomUUID(),
    userId,
    sentAt: nowIso(),
  };

  const delivered = await broadcastToRoom(event, currentConn.roomId, payload);

  return response(200, { ok: true, route: "chatMessage", delivered });
}

async function onReactionMessage(
  event: APIGatewayProxyWebsocketEventV2,
  userId: string | null,
  msg: ReactionMessage,
): Promise<APIGatewayProxyResultV2> {
  if (!userId) {
    return response(401, { message: "Unauthorized" });
  }

  const emoji = readString(msg.emoji);
  if (!emoji || emoji.length > 16) {
    return response(400, { message: "Invalid reaction" });
  }

  const currentConn = await getConnection(event.requestContext.connectionId);

  if (!currentConn?.roomId) {
    return response(403, { message: "Connection has not joined a room" });
  }

  if (msg.roomId && msg.roomId !== currentConn.roomId) {
    return response(403, { message: "Connection has not joined this room" });
  }

  const payload = {
    type: "chat.reaction",
    roomId: currentConn.roomId,
    emoji,
    userId,
    sentAt: nowIso(),
  };

  const delivered = await broadcastToRoom(event, currentConn.roomId, payload);

  return response(200, { ok: true, route: "reaction", delivered });
}

export async function handler(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const routeKey = event.requestContext.routeKey;

  try {
    switch (routeKey) {
      case "$connect":
        return await onConnect(event);
      case "$disconnect":
        return await onDisconnect(event);
      case "joinRoom":
        return await onJoinRoom(event);
      case "leaveRoom":
        return await onLeaveRoom(event);
      case "syncPlayback":
        return await onSyncPlayback(event);
      case "getPlaybackSnapshot":
        return await onGetPlaybackSnapshot(event);
      case "ping":
        return await onPing(event);
      case "chatMessage":
        return await onChatMessage(
          event,
          senderUserId(event),
          parseBody(event) as ChatMessageReceived,
        );
      case "reaction":
        return await onReactionMessage(
          event,
          senderUserId(event),
          parseBody(event) as ReactionMessage,
        );
      case "$default":
      default:
        return response(200, {
          ok: true,
          route: routeKey,
          message: "No-op route",
        });
    }
  } catch (error) {
    console.error("ws-handler-error", { routeKey, error });
    return response(500, { message: "Internal server error", route: routeKey });
  }
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTicketPayload(encodedPayload: string): string {
  const secret = process.env.WS_TICKET_SECRET;

  if (!secret) {
    throw new Error("WS_TICKET_SECRET is required for WebSocket auth");
  }

  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function verifyTicket(token: string | undefined): TicketPayload | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signTicketPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as TicketPayload;
    const now = nowEpochSeconds();

    if (!payload.sub || !payload.exp || payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function buildPolicy(
  principalId: string,
  effect: "Allow" | "Deny",
  resource: string,
  context: Record<string, string> = {},
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };
}

export async function authorizer(
  event: WebSocketAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> {
  const token = event.queryStringParameters?.ticket;
  const payload = verifyTicket(token);

  if (!payload) {
    return buildPolicy(`denied-${randomUUID()}`, "Deny", event.methodArn);
  }

  return buildPolicy(payload.sub, "Allow", event.methodArn, {
    userId: payload.sub,
  });
}
