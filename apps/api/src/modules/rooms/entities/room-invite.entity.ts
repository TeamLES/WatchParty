export interface RoomInvite {
  roomId: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
}
