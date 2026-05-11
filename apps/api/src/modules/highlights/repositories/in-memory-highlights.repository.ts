import { Injectable, Logger } from '@nestjs/common';

import type { Highlight } from '../entities/highlight.entity';
import type {
  HighlightsRepository,
  UpdateHighlightInput,
} from './highlights.repository';

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

  findByCreatorUserId(userId: string): Promise<Highlight[]> {
    this.logger.log(`findByCreatorUserId userId=${userId}`);

    return Promise.resolve(
      Array.from(this.highlightsById.values())
        .filter((highlight) => highlight.createdByUserId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((highlight) => this.cloneHighlight(highlight)),
    );
  }

  async updateHighlight(input: UpdateHighlightInput): Promise<Highlight> {
    this.logger.log(`updateHighlight highlightId=${input.highlightId}`);
    const existing = this.highlightsById.get(input.highlightId);

    if (!existing) {
      throw new Error(`Highlight ${input.highlightId} does not exist`);
    }

    const updated: Highlight = {
      ...existing,
      ...(input.shouldUpdateTitle && input.title
        ? { title: input.title }
        : {}),
      ...(input.shouldUpdateNote && input.note ? { note: input.note } : {}),
      updatedAt: input.updatedAt,
    };

    if (input.shouldUpdateTitle && !input.title) {
      delete updated.title;
    }

    if (input.shouldUpdateNote && !input.note) {
      delete updated.note;
    }

    this.highlightsById.set(updated.highlightId, this.cloneHighlight(updated));
    this.highlightsByRoomId
      .get(updated.roomId)
      ?.set(updated.createdAtHighlightId, this.cloneHighlight(updated));

    return this.cloneHighlight(updated);
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
