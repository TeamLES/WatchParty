import type {
  PlaybackEventKind,
  PlaybackState,
} from "./tables/playback-snapshots.js";
export type { PlaybackEventKind, PlaybackState } from "./tables/playback-snapshots.js";

export interface JoinRoomMessage {
  action: "joinRoom";
  roomId: string;
}

export interface LeaveRoomMessage {
  action: "leaveRoom";
}

export interface SyncPlaybackMessage {
  action: "syncPlayback";
  roomId: string;
  sequence: number;
  eventType: PlaybackEventKind;
  state: PlaybackState;
  positionMs: number;
  eventId: string;
  sentAt: string;
}

export interface GetPlaybackSnapshotMessage {
  action: "getPlaybackSnapshot";
  roomId: string;
}

export interface PingMessage {
  action: "ping";
}

export interface WebSocketTicketResponse {
  wsUrl: string;
  ticket: string;
  expiresAt: string;
}

export type WatchPartyInboundWebSocketMessage =
  | JoinRoomMessage
  | LeaveRoomMessage
  | SyncPlaybackMessage
  | GetPlaybackSnapshotMessage
  | PingMessage;

export interface PlaybackSyncEvent {
  type: "playback.sync";
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

export interface PlaybackSnapshotEvent {
  type: "playback.snapshot";
  roomId: string;
  sequence: number;
  state: PlaybackState;
  positionMs: number;
  updatedByUserId: string;
  updatedAt: string;
  eventId: string;
}

export interface PresenceUpdatedEvent {
  type: "presence.updated";
  roomId: string;
  onlineCount: number;
  updatedAt: string;
}

export interface WatchPartyWebSocketErrorEvent {
  type: "error";
  message: string;
}

export type WatchPartyOutboundWebSocketEvent =
  | PlaybackSyncEvent
  | PlaybackSnapshotEvent
  | PresenceUpdatedEvent
  | WatchPartyWebSocketErrorEvent;
