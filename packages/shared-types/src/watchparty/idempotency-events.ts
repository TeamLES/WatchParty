export interface IdempotencyEvent {
  eventId: string;
  roomId?: string;
  userId?: string;
  eventType: string;
  createdAt: string;
  expiresAt: number;
}
