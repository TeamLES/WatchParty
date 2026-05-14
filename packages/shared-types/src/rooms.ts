export type RoomStatus = "active" | "ended";

export type RoomMemberRole = "host" | "co-host" | "viewer";
export type RoomMemberRsvpStatus = "going" | "not_going" | "maybe" | "none";
export type RoomMemberReminderEmailStatus = "sent" | "skipped" | "failed";
export type ScheduledReminderStatus = "pending" | "sending" | "sent" | "failed";

export interface RoomMemberResponse {
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  nickname?: string | null;
  email?: string | null;
  rsvpStatus?: RoomMemberRsvpStatus;
  rsvpUpdatedAt?: string | null;
  reminderEmailSentAt?: string | null;
  reminderEmailStatus?: RoomMemberReminderEmailStatus | null;
  reminderEmailError?: string | null;
  reminderEmailMessageId?: string | null;
}

export interface RoomSummaryResponse {
  roomId: string;
  title: string;
  videoUrl: string | null;
  isPrivate: boolean;
  password: string | null;
  hostUserId: string;
  coHostUserId: string | null;
  maxCapacity: number | null;
  activeWatcherCount: number;
  onlineCount?: number | null;
  isScheduled: boolean;
  scheduledStartAt: string | null;
  reminderMinutesBefore: number | null;
  reminderAt: string | null;
  reminderSentAt: string | null;
  reminderStatus: ScheduledReminderStatus | null;
  scheduledTitle: string | null;
  scheduledDescription: string | null;
  scheduledTimezone: string | null;
  appRoomUrl: string | null;
  status: RoomStatus;
  createdAt: string;
}

export type CreateRoomResponse = RoomSummaryResponse;

export interface GetRoomResponse extends RoomSummaryResponse {
  members: RoomMemberResponse[];
  isHost: boolean;
  isCoHost: boolean;
  isController: boolean;
  isMember: boolean;
}

export type GetRoomsResponse = RoomSummaryResponse[];

export interface JoinRoomResponse {
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  alreadyMember: boolean;
}

export interface CreateRoomInviteResponse {
  roomId: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface GetRoomMembersResponse {
  roomId: string;
  activeWatcherCount: number;
  members: RoomMemberResponse[];
}

export interface CreateScheduledRoomResponse extends RoomSummaryResponse {
  inviteUrl: string;
}

export interface RsvpRoomResponse {
  roomId: string;
  member: RoomMemberResponse;
}

export interface GetRoomAttendeesResponse {
  roomId: string;
  attendees: RoomMemberResponse[];
}
