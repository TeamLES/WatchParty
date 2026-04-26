export interface Invite {
  inviteCode: string;
  roomId: string;
  createdByUserId: string;
  createdAt: string;
  expiresAt?: number;
  maxUses?: number;
  usedCount?: number;
}
