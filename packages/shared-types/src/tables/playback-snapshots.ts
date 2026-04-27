export type PlaybackState = 'playing' | 'paused';
export type PlaybackEventKind = 'play' | 'pause' | 'seek' | 'position';

export interface PlaybackSnapshot {
  roomId: string;
  sequence: number;
  eventType: PlaybackEventKind;
  state: PlaybackState;
  positionMs: number;
  updatedByUserId: string;
  updatedAt: string;
  eventId: string;
  sentAt: string;
}
