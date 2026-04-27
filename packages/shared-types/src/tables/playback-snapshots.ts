export type PlaybackState = 'playing' | 'paused';

export interface PlaybackSnapshot {
  roomId: string;
  sequence: number;
  state: PlaybackState;
  positionMs: number;
  updatedByUserId: string;
  updatedAt: string;
  eventId: string;
}
