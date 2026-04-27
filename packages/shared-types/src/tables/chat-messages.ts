export interface ChatMessage {
  roomId: string;
  sentAtMessageId: string;
  expiresAt?: number;
  messageId: string;
  sentAt: string;
  text: string;
  userId: string;
}
