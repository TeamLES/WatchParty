import type { RoomInvite } from '../entities/room-invite.entity';
import type { RoomMember } from '../entities/room-member.entity';
import type { Room } from '../entities/room.entity';

export interface RoomItem {
  roomId: string;
  hostUserId: string;
  coHostUserId?: string | null;
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
  isScheduled?: boolean;
  scheduledStartAt?: string;
  reminderMinutesBefore?: number;
  reminderAt?: string;
  reminderSentAt?: string;
  reminderStatus?: 'pending' | 'sending' | 'sent' | 'failed';
  reminderClaimedAt?: string;
  reminderError?: string;
  scheduledTitle?: string;
  scheduledDescription?: string;
  scheduledTimezone?: string;
  appRoomUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RoomMemberItem {
  roomId: string;
  userId: string;
  role: 'host' | 'co-host' | 'viewer';
  joinedAt: string;
  lastSeenAt?: string;
  nickname?: string;
  email?: string;
  rsvpStatus?: 'going' | 'not_going' | 'maybe' | 'none';
  rsvpUpdatedAt?: string;
  reminderEmailSentAt?: string;
  reminderEmailStatus?: 'sent' | 'skipped' | 'failed';
  reminderEmailError?: string;
  reminderEmailMessageId?: string;
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
    ...(room.coHostUserId ? { coHostUserId: room.coHostUserId } : {}),
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
    ...(room.isScheduled !== undefined
      ? { isScheduled: room.isScheduled }
      : {}),
    ...(room.scheduledStartAt
      ? { scheduledStartAt: room.scheduledStartAt }
      : {}),
    ...(room.reminderMinutesBefore !== undefined
      ? { reminderMinutesBefore: room.reminderMinutesBefore }
      : {}),
    ...(room.reminderAt ? { reminderAt: room.reminderAt } : {}),
    ...(room.reminderSentAt ? { reminderSentAt: room.reminderSentAt } : {}),
    ...(room.reminderStatus ? { reminderStatus: room.reminderStatus } : {}),
    ...(room.reminderClaimedAt
      ? { reminderClaimedAt: room.reminderClaimedAt }
      : {}),
    ...(room.reminderError ? { reminderError: room.reminderError } : {}),
    ...(room.scheduledTitle ? { scheduledTitle: room.scheduledTitle } : {}),
    ...(room.scheduledDescription
      ? { scheduledDescription: room.scheduledDescription }
      : {}),
    ...(room.scheduledTimezone
      ? { scheduledTimezone: room.scheduledTimezone }
      : {}),
    ...(room.appRoomUrl ? { appRoomUrl: room.appRoomUrl } : {}),
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
    ...(member.email ? { email: member.email } : {}),
    ...(member.rsvpStatus ? { rsvpStatus: member.rsvpStatus } : {}),
    ...(member.rsvpUpdatedAt ? { rsvpUpdatedAt: member.rsvpUpdatedAt } : {}),
    ...(member.reminderEmailSentAt
      ? { reminderEmailSentAt: member.reminderEmailSentAt }
      : {}),
    ...(member.reminderEmailStatus
      ? { reminderEmailStatus: member.reminderEmailStatus }
      : {}),
    ...(member.reminderEmailError
      ? { reminderEmailError: member.reminderEmailError }
      : {}),
    ...(member.reminderEmailMessageId
      ? { reminderEmailMessageId: member.reminderEmailMessageId }
      : {}),
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
  const coHostUserId = readNullableString(item.coHostUserId);
  const maxCapacity = readNullableNumber(item.maxCapacity);
  const activeWatcherCount = readNullableNumber(item.activeWatcherCount) ?? 0;
  const isScheduled = readBoolean(item.isScheduled) ?? false;
  const scheduledStartAt = readNullableString(item.scheduledStartAt);
  const reminderMinutesBefore = readNullableNumber(item.reminderMinutesBefore);
  const reminderAt = readNullableString(item.reminderAt);
  const reminderSentAt = readNullableString(item.reminderSentAt);
  const reminderStatusRaw = readNullableString(item.reminderStatus);
  const reminderClaimedAt = readNullableString(item.reminderClaimedAt);
  const reminderError = readNullableString(item.reminderError);
  const scheduledTitle = readNullableString(item.scheduledTitle);
  const scheduledDescription = readNullableString(item.scheduledDescription);
  const scheduledTimezone = readNullableString(item.scheduledTimezone);
  const appRoomUrl = readNullableString(item.appRoomUrl);
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
  const reminderStatus =
    reminderStatusRaw === 'pending' ||
    reminderStatusRaw === 'sending' ||
    reminderStatusRaw === 'sent' ||
    reminderStatusRaw === 'failed'
      ? reminderStatusRaw
      : undefined;

  if (isPrivate && !password && !isScheduled) {
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
    ...(coHostUserId ? { coHostUserId } : {}),
    ...(maxCapacity !== null ? { maxCapacity } : {}),
    activeWatcherCount,
    ...(isScheduled ? { isScheduled } : {}),
    ...(scheduledStartAt ? { scheduledStartAt } : {}),
    ...(reminderMinutesBefore !== null ? { reminderMinutesBefore } : {}),
    ...(reminderAt ? { reminderAt } : {}),
    ...(reminderSentAt ? { reminderSentAt } : {}),
    ...(reminderStatus ? { reminderStatus } : {}),
    ...(reminderClaimedAt ? { reminderClaimedAt } : {}),
    ...(reminderError ? { reminderError } : {}),
    ...(scheduledTitle ? { scheduledTitle } : {}),
    ...(scheduledDescription ? { scheduledDescription } : {}),
    ...(scheduledTimezone ? { scheduledTimezone } : {}),
    ...(appRoomUrl ? { appRoomUrl } : {}),
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
  const email = readNullableString(item.email);
  const rsvpStatusRaw = readNullableString(item.rsvpStatus);
  const rsvpUpdatedAt = readNullableString(item.rsvpUpdatedAt);
  const reminderEmailSentAt = readNullableString(item.reminderEmailSentAt);
  const reminderEmailStatusRaw = readNullableString(item.reminderEmailStatus);
  const reminderEmailError = readNullableString(item.reminderEmailError);
  const reminderEmailMessageId = readNullableString(
    item.reminderEmailMessageId,
  );

  if (!roomId || !userId || !joinedAt) {
    return null;
  }

  if (roleRaw !== 'host' && roleRaw !== 'co-host' && roleRaw !== 'viewer') {
    return null;
  }
  const rsvpStatus =
    rsvpStatusRaw === 'going' ||
    rsvpStatusRaw === 'not_going' ||
    rsvpStatusRaw === 'maybe' ||
    rsvpStatusRaw === 'none'
      ? rsvpStatusRaw
      : undefined;
  const reminderEmailStatus =
    reminderEmailStatusRaw === 'sent' ||
    reminderEmailStatusRaw === 'skipped' ||
    reminderEmailStatusRaw === 'failed'
      ? reminderEmailStatusRaw
      : undefined;

  return {
    roomId,
    userId,
    role: roleRaw,
    joinedAt,
    ...(lastSeenAt ? { lastSeenAt } : {}),
    ...(nickname ? { nickname } : {}),
    ...(email ? { email } : {}),
    ...(rsvpStatus ? { rsvpStatus } : {}),
    ...(rsvpUpdatedAt ? { rsvpUpdatedAt } : {}),
    ...(reminderEmailSentAt ? { reminderEmailSentAt } : {}),
    ...(reminderEmailStatus ? { reminderEmailStatus } : {}),
    ...(reminderEmailError ? { reminderEmailError } : {}),
    ...(reminderEmailMessageId ? { reminderEmailMessageId } : {}),
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
