export interface WebSocketConnection {
  connectionId: string;
  roomId?: string;
  userId: string;
  connectedAt: string;
  lastSeenAt: string;
  expiresAt: number;
}
