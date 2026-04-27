export type RoomMemberRole = 'host' | 'viewer' | 'moderator';

export interface RoomMember {
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  lastSeenAt?: string;
  nickname?: string;
}
