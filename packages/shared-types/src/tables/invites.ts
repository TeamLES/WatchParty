export interface Invite {
  inviteCode: string;
  createdAt: string;
  createdByUserId: string;
  expiresAt?: number;
  maxUses?: number;
  roomId: string;
  usedCount?: number;
}
