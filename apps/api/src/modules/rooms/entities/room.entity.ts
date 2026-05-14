export type RoomStatus = 'active';
export type RoomVisibilityStatus = 'public' | 'private';
export type ScheduledReminderStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface Room {
  roomId: string;
  title: string;
  videoUrl?: string;
  videoProvider?: string;
  videoId?: string;
  isPrivate: boolean;
  password?: string;
  visibilityStatus?: RoomVisibilityStatus;
  hostUserId: string;
  coHostUserId?: string | null;
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
  status: RoomStatus;
  createdAt: string;
  updatedAt?: string;
}
