import { Injectable, Logger } from '@nestjs/common';

import type { Highlight } from '../entities/highlight.entity';
import type { HighlightsRepository } from './highlights.repository';

@Injectable()
export class InMemoryHighlightsRepository implements HighlightsRepository {
  private readonly logger = new Logger(InMemoryHighlightsRepository.name);
  private readonly highlightsByRoomId = new Map<
    string,
    Map<string, Highlight>
  >();
  private readonly highlightsById = new Map<string, Highlight>();

  constructor() {
    this.logger.log('driver=inmemory initialized');
  }

  createHighlight(highlight: Highlight): Promise<Highlight> {
    this.logger.log(
      `createHighlight roomId=${highlight.roomId} highlightId=${highlight.highlightId}`,
    );
    let roomHighlights = this.highlightsByRoomId.get(highlight.roomId);

    if (!roomHighlights) {
      roomHighlights = new Map<string, Highlight>();
      this.highlightsByRoomId.set(highlight.roomId, roomHighlights);
    }

    const copy = this.cloneHighlight(highlight);
    roomHighlights.set(highlight.createdAtHighlightId, copy);
    this.highlightsById.set(highlight.highlightId, copy);

    return Promise.resolve(this.cloneHighlight(copy));
  }

  listHighlightsByRoomId(roomId: string): Promise<Highlight[]> {
    this.logger.log(`listHighlightsByRoomId roomId=${roomId}`);
    const roomHighlights = this.highlightsByRoomId.get(roomId);

    if (!roomHighlights) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      Array.from(roomHighlights.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((highlight) => this.cloneHighlight(highlight)),
    );
  }

  getHighlightById(highlightId: string): Promise<Highlight | null> {
    this.logger.log(`getHighlightById highlightId=${highlightId}`);
    const highlight = this.highlightsById.get(highlightId);
    return Promise.resolve(highlight ? this.cloneHighlight(highlight) : null);
  }

  deleteHighlight(highlight: Highlight): Promise<void> {
    this.logger.log(
      `deleteHighlight roomId=${highlight.roomId} highlightId=${highlight.highlightId}`,
    );
    this.highlightsById.delete(highlight.highlightId);
    this.highlightsByRoomId
      .get(highlight.roomId)
      ?.delete(highlight.createdAtHighlightId);

    return Promise.resolve();
  }

  private cloneHighlight(highlight: Highlight): Highlight {
    return { ...highlight };
  }
}
