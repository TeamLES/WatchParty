export type RoomMemberRole = 'host' | 'viewer';

export interface RoomMember {
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
}
