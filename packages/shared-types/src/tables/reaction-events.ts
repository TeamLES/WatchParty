export type ReactionTargetType = 'room' | 'message' | 'playback';

export interface ReactionEvent {
  roomId: string;
  occurredAtReactionId: string;
  reactionId: string;
  userId: string;
  emoji: string;
  targetType: ReactionTargetType;
  targetId: string;
  occurredAt: string;
  expiresAt?: number;
}
