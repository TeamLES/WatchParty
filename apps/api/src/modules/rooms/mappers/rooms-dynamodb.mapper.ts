import type { RoomInvite } from '../entities/room-invite.entity';
import type { RoomMember } from '../entities/room-member.entity';
import type { Room } from '../entities/room.entity';

const ROOM_PK_PREFIX = 'ROOM#';
const MEMBER_SK_PREFIX = 'MEMBER#';
const INVITE_SK_PREFIX = 'INVITE#';

export interface RoomMetaItem {
  PK: string;
  SK: 'META';
  entityType: 'ROOM';
  roomId: string;
  title: string;
  videoUrl?: string;
  isPrivate?: boolean;
  password?: string;
  hostUserId: string;
  status: 'active';
  createdAt: string;
}

export interface RoomMemberItem {
  PK: string;
  SK: string;
  entityType: 'ROOM_MEMBER';
  roomId: string;
  userId: string;
  role: 'host' | 'viewer';
  joinedAt: string;
}

export interface RoomInviteItem {
  PK: string;
  SK: string;
  entityType: 'ROOM_INVITE';
  roomId: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string | null;
}

type UnknownItem = Record<string, unknown>;

export function buildRoomPk(roomId: string): string {
  return `${ROOM_PK_PREFIX}${roomId}`;
}

export function buildMetaSk(): 'META' {
  return 'META';
}

export function buildMemberSk(userId: string): string {
  return `${MEMBER_SK_PREFIX}${userId}`;
}

export function buildInviteSk(inviteCode: string): string {
  return `${INVITE_SK_PREFIX}${inviteCode}`;
}

export function toRoomMetaItem(room: Room): RoomMetaItem {
  return {
    PK: buildRoomPk(room.roomId),
    SK: buildMetaSk(),
    entityType: 'ROOM',
    roomId: room.roomId,
    title: room.title,
    ...(room.videoUrl ? { videoUrl: room.videoUrl } : {}),
    isPrivate: room.isPrivate,
    ...(room.password ? { password: room.password } : {}),
    hostUserId: room.hostUserId,
    status: room.status,
    createdAt: room.createdAt,
  };
}

export function toRoomMemberItem(member: RoomMember): RoomMemberItem {
  return {
    PK: buildRoomPk(member.roomId),
    SK: buildMemberSk(member.userId),
    entityType: 'ROOM_MEMBER',
    roomId: member.roomId,
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt,
  };
}

export function toRoomInviteItem(invite: RoomInvite): RoomInviteItem {
  return {
    PK: buildRoomPk(invite.roomId),
    SK: buildInviteSk(invite.inviteCode),
    entityType: 'ROOM_INVITE',
    roomId: invite.roomId,
    inviteCode: invite.inviteCode,
    createdBy: invite.createdBy,
    createdAt: invite.createdAt,
    ...(invite.expiresAt ? { expiresAt: invite.expiresAt } : {}),
  };
}

export function fromRoomMetaItem(item: UnknownItem | undefined): Room | null {
  if (!item || item.entityType !== 'ROOM' || item.SK !== 'META') {
    return null;
  }

  const roomId = readString(item.roomId);
  const title = readString(item.title);
  const videoUrl = readNullableString(item.videoUrl);
  const isPrivate = readBoolean(item.isPrivate) ?? false;
  const password = readNullableString(item.password);
  const hostUserId = readString(item.hostUserId);
  const createdAt = readString(item.createdAt);

  if (!roomId || !title || !hostUserId || !createdAt) {
    return null;
  }

  if (isPrivate && !password) {
    return null;
  }

  return {
    roomId,
    title,
    ...(videoUrl ? { videoUrl } : {}),
    isPrivate,
    ...(password ? { password } : {}),
    hostUserId,
    status: 'active',
    createdAt,
  };
}

export function fromRoomMemberItem(
  item: UnknownItem | undefined,
): RoomMember | null {
  if (!item || item.entityType !== 'ROOM_MEMBER') {
    return null;
  }

  const roomId = readString(item.roomId);
  const userId = readString(item.userId);
  const roleRaw = readString(item.role);
  const joinedAt = readString(item.joinedAt);

  if (!roomId || !userId || !joinedAt) {
    return null;
  }

  if (roleRaw !== 'host' && roleRaw !== 'viewer') {
    return null;
  }

  return {
    roomId,
    userId,
    role: roleRaw,
    joinedAt,
  };
}

export function fromRoomInviteItem(
  item: UnknownItem | undefined,
): RoomInvite | null {
  if (!item || item.entityType !== 'ROOM_INVITE') {
    return null;
  }

  const roomId = readString(item.roomId);
  const inviteCode = readString(item.inviteCode);
  const createdBy = readString(item.createdBy);
  const createdAt = readString(item.createdAt);
  const expiresAt = readNullableString(item.expiresAt);

  if (!roomId || !inviteCode || !createdBy || !createdAt) {
    return null;
  }

  return {
    roomId,
    inviteCode,
    createdBy,
    createdAt,
    ...(expiresAt ? { expiresAt } : {}),
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
