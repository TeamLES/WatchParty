export interface RoomInvite {
  roomId: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  maxUses?: number;
  usedCount?: number;
}
