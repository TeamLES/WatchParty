export type RoomMemberRole = 'host' | 'co-host' | 'viewer';
export type RoomMemberRsvpStatus = 'going' | 'not_going' | 'maybe' | 'none';
export type RoomMemberReminderEmailStatus = 'sent' | 'skipped' | 'failed';

export interface RoomMember {
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  lastSeenAt?: string;
  nickname?: string;
  email?: string;
  rsvpStatus?: RoomMemberRsvpStatus;
  rsvpUpdatedAt?: string;
  reminderEmailSentAt?: string;
  reminderEmailStatus?: RoomMemberReminderEmailStatus;
  reminderEmailError?: string;
  reminderEmailMessageId?: string;
}
