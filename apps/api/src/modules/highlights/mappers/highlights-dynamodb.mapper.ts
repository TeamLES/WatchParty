import type { Highlight } from '../entities/highlight.entity';

export interface HighlightItem {
  highlightId: string;
  roomId: string;
  createdAtHighlightId: string;
  videoUrl: string;
  videoProvider: 'youtube';
  videoId: string;
  startMs: number;
  endMs: number;
  title?: string;
  note?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

type UnknownItem = Record<string, unknown>;

export function toHighlightItem(highlight: Highlight): HighlightItem {
  return {
    highlightId: highlight.highlightId,
    roomId: highlight.roomId,
    createdAtHighlightId: highlight.createdAtHighlightId,
    videoUrl: highlight.videoUrl,
    videoProvider: highlight.videoProvider,
    videoId: highlight.videoId,
    startMs: highlight.startMs,
    endMs: highlight.endMs,
    ...(highlight.title ? { title: highlight.title } : {}),
    ...(highlight.note ? { note: highlight.note } : {}),
    createdByUserId: highlight.createdByUserId,
    createdAt: highlight.createdAt,
    updatedAt: highlight.updatedAt,
  };
}

export function fromHighlightItem(
  item: UnknownItem | undefined,
): Highlight | null {
  if (!item) {
    return null;
  }

  const highlightId = readString(item.highlightId);
  const roomId = readString(item.roomId);
  const createdAtHighlightId = readString(item.createdAtHighlightId);
  const videoUrl = readString(item.videoUrl);
  const videoProvider = readString(item.videoProvider);
  const videoId = readString(item.videoId);
  const startMs = readNumber(item.startMs);
  const endMs = readNumber(item.endMs);
  const title = readNullableString(item.title);
  const note = readNullableString(item.note);
  const createdByUserId = readString(item.createdByUserId);
  const createdAt = readString(item.createdAt);
  const updatedAt = readString(item.updatedAt);

  if (
    !highlightId ||
    !roomId ||
    !createdAtHighlightId ||
    !videoUrl ||
    videoProvider !== 'youtube' ||
    !videoId ||
    startMs === null ||
    endMs === null ||
    !createdByUserId ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    highlightId,
    roomId,
    createdAtHighlightId,
    videoUrl,
    videoProvider,
    videoId,
    startMs,
    endMs,
    ...(title ? { title } : {}),
    ...(note ? { note } : {}),
    createdByUserId,
    createdAt,
    updatedAt,
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
