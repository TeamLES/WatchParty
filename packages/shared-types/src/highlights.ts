export type HighlightVideoProvider = "youtube";

export interface HighlightResponse {
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

export interface CreateHighlightRequest {
  startMs: number;
  endMs: number;
  title?: string;
  note?: string;
}

export interface CreateHighlightResponse {
  highlight: HighlightResponse;
}

export interface GetHighlightsResponse {
  highlights: HighlightResponse[];
}
