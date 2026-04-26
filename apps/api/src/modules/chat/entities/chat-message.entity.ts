export interface ChatMessage {
  roomId: string;
  sentAtMessageId: string;
  messageId: string;
  senderUserId: string;
  content: string;
  sentAt: string;
  deletedAt?: string;
}
