import type { RoomInvite } from '../entities/room-invite.entity';
import type { RoomMember } from '../entities/room-member.entity';
import type { Room } from '../entities/room.entity';

export interface RoomItem {
  roomId: string;
  hostUserId: string;
  title: string;
  videoUrl?: string;
  videoProvider?: string;
  videoId?: string;
  status: 'active';
  isPrivate?: boolean;
  password?: string;
  visibilityStatus?: 'public' | 'private';
  maxCapacity?: number | null;
  activeWatcherCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface RoomMemberItem {
  roomId: string;
  userId: string;
  role: 'host' | 'viewer';
  joinedAt: string;
  lastSeenAt?: string;
  nickname?: string;
}

export interface RoomInviteItem {
  inviteCode: string;
  roomId: string;
  createdByUserId: string;
  // Backward compatibility with older items that used createdBy.
  createdBy?: string;
  createdAt: string;
  expiresAt?: string | null;
  maxUses?: number;
  usedCount?: number;
}

type UnknownItem = Record<string, unknown>;

export function toRoomItem(room: Room): RoomItem {
  return {
    roomId: room.roomId,
    hostUserId: room.hostUserId,
    title: room.title,
    ...(room.videoUrl ? { videoUrl: room.videoUrl } : {}),
    ...(room.videoProvider ? { videoProvider: room.videoProvider } : {}),
    ...(room.videoId ? { videoId: room.videoId } : {}),
    status: room.status,
    isPrivate: room.isPrivate,
    ...(room.password ? { password: room.password } : {}),
    ...(room.visibilityStatus
      ? { visibilityStatus: room.visibilityStatus }
      : {}),
    ...(room.maxCapacity !== undefined && room.maxCapacity !== null
      ? { maxCapacity: room.maxCapacity }
      : {}),
    activeWatcherCount: room.activeWatcherCount,
    createdAt: room.createdAt,
    ...(room.updatedAt ? { updatedAt: room.updatedAt } : {}),
  };
}

export function toRoomMemberItem(member: RoomMember): RoomMemberItem {
  return {
    roomId: member.roomId,
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt,
    ...(member.lastSeenAt ? { lastSeenAt: member.lastSeenAt } : {}),
    ...(member.nickname ? { nickname: member.nickname } : {}),
  };
}

export function toRoomInviteItem(invite: RoomInvite): RoomInviteItem {
  return {
    inviteCode: invite.inviteCode,
    roomId: invite.roomId,
    createdByUserId: invite.createdBy,
    createdAt: invite.createdAt,
    ...(invite.expiresAt ? { expiresAt: invite.expiresAt } : {}),
    ...(invite.maxUses !== undefined ? { maxUses: invite.maxUses } : {}),
    ...(invite.usedCount !== undefined ? { usedCount: invite.usedCount } : {}),
  };
}

export function fromRoomItem(item: UnknownItem | undefined): Room | null {
  if (!item) {
    return null;
  }

  const roomId = readString(item.roomId);
  const title = readString(item.title);
  const videoUrl = readNullableString(item.videoUrl);
  const videoProvider = readNullableString(item.videoProvider);
  const videoId = readNullableString(item.videoId);
  const isPrivate = readBoolean(item.isPrivate) ?? false;
  const password = readNullableString(item.password);
  const hostUserId = readString(item.hostUserId);
  const maxCapacity = readNullableNumber(item.maxCapacity);
  const activeWatcherCount = readNullableNumber(item.activeWatcherCount) ?? 0;
  const createdAt = readString(item.createdAt);
  const updatedAt = readNullableString(item.updatedAt);
  const visibilityStatusRaw = readNullableString(item.visibilityStatus);

  if (!roomId || !title || !hostUserId || !createdAt) {
    return null;
  }

  const visibilityStatus =
    visibilityStatusRaw === 'public' || visibilityStatusRaw === 'private'
      ? visibilityStatusRaw
      : undefined;

  if (isPrivate && !password) {
    return null;
  }

  return {
    roomId,
    title,
    ...(videoUrl ? { videoUrl } : {}),
    ...(videoProvider ? { videoProvider } : {}),
    ...(videoId ? { videoId } : {}),
    isPrivate,
    ...(password ? { password } : {}),
    ...(visibilityStatus ? { visibilityStatus } : {}),
    hostUserId,
    ...(maxCapacity !== null ? { maxCapacity } : {}),
    activeWatcherCount,
    status: 'active',
    createdAt,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export function fromRoomMemberItem(
  item: UnknownItem | undefined,
): RoomMember | null {
  if (!item) {
    return null;
  }

  const roomId = readString(item.roomId);
  const userId = readString(item.userId);
  const roleRaw = readString(item.role);
  const joinedAt = readString(item.joinedAt);
  const lastSeenAt = readNullableString(item.lastSeenAt);
  const nickname = readNullableString(item.nickname);

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
    ...(lastSeenAt ? { lastSeenAt } : {}),
    ...(nickname ? { nickname } : {}),
  };
}

export function fromRoomInviteItem(
  item: UnknownItem | undefined,
): RoomInvite | null {
  if (!item) {
    return null;
  }

  const roomId = readString(item.roomId);
  const inviteCode = readString(item.inviteCode);
  const createdBy =
    readString(item.createdByUserId) ?? readString(item.createdBy);
  const createdAt = readString(item.createdAt);
  const expiresAt = readNullableString(item.expiresAt);
  const maxUses = readNullableNumber(item.maxUses);
  const usedCount = readNullableNumber(item.usedCount);

  if (!roomId || !inviteCode || !createdBy || !createdAt) {
    return null;
  }

  return {
    roomId,
    inviteCode,
    createdBy,
    createdAt,
    ...(expiresAt ? { expiresAt } : {}),
    ...(maxUses !== null ? { maxUses } : {}),
    ...(usedCount !== null ? { usedCount } : {}),
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

function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'number' ? value : null;
}
