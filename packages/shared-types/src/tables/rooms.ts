export type RoomStatus = "active";

export type RoomVisibilityStatus = "public" | "private";
export type ScheduledReminderStatus = "pending" | "sending" | "sent" | "failed";

export interface Room {
  roomId: string;
  hostUserId: string;
  coHostUserId?: string | null;
  title: string;
  videoUrl?: string;
  status: RoomStatus;
  isPrivate: boolean;
  password?: string;
  visibilityStatus: RoomVisibilityStatus;
  maxCapacity?: number | null;
  activeWatcherCount: number;
  isScheduled?: boolean;
  scheduledStartAt?: string;
  reminderMinutesBefore?: number;
  reminderAt?: string;
  reminderSentAt?: string;
  reminderStatus?: ScheduledReminderStatus;
  reminderClaimedAt?: string;
  reminderError?: string;
  scheduledTitle?: string;
  scheduledDescription?: string;
  scheduledTimezone?: string;
  appRoomUrl?: string;
  createdAt: string;
  updatedAt: string;
}
