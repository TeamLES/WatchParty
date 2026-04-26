export interface ChatMessage {
  roomId: string;
  sentAtMessageId: string;
  messageId: string;
  userId: string;
  text: string;
  sentAt: string;
  editedAt?: string;
  deletedAt?: string;
  expiresAt?: number;
}
