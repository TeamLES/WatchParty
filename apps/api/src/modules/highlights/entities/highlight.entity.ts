export type HighlightVideoProvider = 'youtube';

export interface Highlight {
  highlightId: string;
  roomId: string;
  createdAtHighlightId: string;
  videoUrl: string;
  videoProvider: HighlightVideoProvider;
  videoId: string;
  startMs: number;
  endMs: number;
  title?: string;
  note?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}
