import type { Highlight } from '../entities/highlight.entity';

export const HIGHLIGHTS_REPOSITORY = Symbol('HIGHLIGHTS_REPOSITORY');

export interface HighlightsRepository {
  createHighlight(highlight: Highlight): Promise<Highlight>;
  listHighlightsByRoomId(roomId: string): Promise<Highlight[]>;
  getHighlightById(highlightId: string): Promise<Highlight | null>;
  deleteHighlight(highlight: Highlight): Promise<void>;
}
