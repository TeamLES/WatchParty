import type { Highlight } from '../entities/highlight.entity';

export const HIGHLIGHTS_REPOSITORY = Symbol('HIGHLIGHTS_REPOSITORY');

export interface UpdateHighlightInput {
  highlightId: string;
  title?: string;
  note?: string;
  shouldUpdateTitle: boolean;
  shouldUpdateNote: boolean;
  updatedAt: string;
}

export interface HighlightsRepository {
  createHighlight(highlight: Highlight): Promise<Highlight>;
  listHighlightsByRoomId(roomId: string): Promise<Highlight[]>;
  findByCreatorUserId(userId: string): Promise<Highlight[]>;
  getHighlightById(highlightId: string): Promise<Highlight | null>;
  updateHighlight(input: UpdateHighlightInput): Promise<Highlight>;
  deleteHighlight(highlight: Highlight): Promise<void>;
}
