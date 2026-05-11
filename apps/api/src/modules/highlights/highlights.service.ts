import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import type {
  CreateHighlightResponse,
  GetHighlightsResponse,
  GetMyHighlightsResponse,
  HighlightResponse,
  UpdateHighlightResponse,
} from '@watchparty/shared-types';
import { ROOMS_REPOSITORY } from '../rooms/constants/rooms-repository.token';
import type { RoomsRepository } from '../rooms/repositories/rooms.repository';
import type { CreateHighlightDto } from './dto/create-highlight.dto';
import type { UpdateHighlightDto } from './dto/update-highlight.dto';
import type { Highlight } from './entities/highlight.entity';
import {
  HIGHLIGHTS_REPOSITORY,
  type HighlightsRepository,
} from './repositories/highlights.repository';
import { extractYoutubeVideoId } from './utils/youtube';

const MAX_HIGHLIGHT_LENGTH_MS = 120000;

@Injectable()
export class HighlightsService {
  private readonly logger = new Logger(HighlightsService.name);

  constructor(
    @Inject(HIGHLIGHTS_REPOSITORY)
    private readonly highlightsRepository: HighlightsRepository,
    @Inject(ROOMS_REPOSITORY)
    private readonly roomsRepository: RoomsRepository,
  ) {
    this.logger.log(
      `initialized repository=${this.highlightsRepository.constructor.name}`,
    );
  }

  async createHighlight(
    roomId: string,
    userId: string,
    createHighlightDto: CreateHighlightDto,
  ): Promise<CreateHighlightResponse> {
    this.logger.log(`createHighlight roomId=${roomId} userId=${userId}`);
    const room = await this.getRoomOrThrow(roomId);
    await this.requireRoomMember(roomId, userId);

    if (!room.videoUrl) {
      throw new BadRequestException('Room must have a videoUrl');
    }

    const videoId = extractYoutubeVideoId(room.videoUrl);
    if (!videoId) {
      throw new BadRequestException(
        'Room videoUrl must be a valid YouTube URL',
      );
    }

    if (createHighlightDto.endMs <= createHighlightDto.startMs) {
      throw new BadRequestException('endMs must be greater than startMs');
    }

    if (
      createHighlightDto.endMs - createHighlightDto.startMs >
      MAX_HIGHLIGHT_LENGTH_MS
    ) {
      throw new BadRequestException(
        `Highlight length cannot exceed ${MAX_HIGHLIGHT_LENGTH_MS}ms`,
      );
    }

    const highlightId = randomUUID();
    const createdAt = this.nowIsoString();
    const highlight: Highlight = {
      highlightId,
      roomId,
      createdAtHighlightId: `${createdAt}#${highlightId}`,
      videoUrl: room.videoUrl,
      videoProvider: 'youtube',
      videoId,
      startMs: createHighlightDto.startMs,
      endMs: createHighlightDto.endMs,
      ...(createHighlightDto.title ? { title: createHighlightDto.title } : {}),
      ...(createHighlightDto.note ? { note: createHighlightDto.note } : {}),
      createdByUserId: userId,
      createdAt,
      updatedAt: createdAt,
    };

    const createdHighlight =
      await this.highlightsRepository.createHighlight(highlight);

    return {
      highlight: this.toHighlightResponse(createdHighlight),
    };
  }

  async getHighlights(
    roomId: string,
    userId: string,
  ): Promise<GetHighlightsResponse> {
    this.logger.log(`getHighlights roomId=${roomId} userId=${userId}`);
    await this.getRoomOrThrow(roomId);
    await this.requireRoomMember(roomId, userId);

    const highlights =
      await this.highlightsRepository.listHighlightsByRoomId(roomId);

    return {
      highlights: highlights.map((highlight) =>
        this.toHighlightResponse(highlight),
      ),
    };
  }

  async getMyHighlights(userId: string): Promise<GetMyHighlightsResponse> {
    this.logger.log(`getMyHighlights userId=${userId}`);
    const highlights =
      await this.highlightsRepository.findByCreatorUserId(userId);

    return {
      highlights: highlights.map((highlight) =>
        this.toHighlightResponse(highlight),
      ),
    };
  }

  async updateHighlight(
    roomId: string,
    highlightId: string,
    userId: string,
    updateHighlightDto: UpdateHighlightDto,
  ): Promise<UpdateHighlightResponse> {
    this.logger.log(
      `updateHighlight roomId=${roomId} highlightId=${highlightId} userId=${userId}`,
    );
    const highlight =
      await this.highlightsRepository.getHighlightById(highlightId);

    if (!highlight || highlight.roomId !== roomId) {
      throw new NotFoundException('Highlight not found');
    }

    if (highlight.createdByUserId !== userId) {
      throw new ForbiddenException(
        'Only the highlight creator can update this highlight',
      );
    }

    const shouldUpdateTitle = Object.prototype.hasOwnProperty.call(
      updateHighlightDto,
      'title',
    );
    const shouldUpdateNote = Object.prototype.hasOwnProperty.call(
      updateHighlightDto,
      'note',
    );

    if (!shouldUpdateTitle && !shouldUpdateNote) {
      throw new BadRequestException('At least one highlight field is required');
    }

    const updatedHighlight = await this.highlightsRepository.updateHighlight({
      highlightId,
      ...(updateHighlightDto.title ? { title: updateHighlightDto.title } : {}),
      ...(updateHighlightDto.note ? { note: updateHighlightDto.note } : {}),
      shouldUpdateTitle,
      shouldUpdateNote,
      updatedAt: this.nowIsoString(),
    });

    return {
      highlight: this.toHighlightResponse(updatedHighlight),
    };
  }

  async deleteHighlight(
    roomId: string,
    highlightId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(
      `deleteHighlight roomId=${roomId} highlightId=${highlightId} userId=${userId}`,
    );
    const room = await this.getRoomOrThrow(roomId);
    const highlight =
      await this.highlightsRepository.getHighlightById(highlightId);

    if (!highlight || highlight.roomId !== roomId) {
      throw new NotFoundException('Highlight not found');
    }

    if (highlight.createdByUserId !== userId && room.hostUserId !== userId) {
      throw new ForbiddenException(
        'Only the highlight creator or room host can delete this highlight',
      );
    }

    await this.highlightsRepository.deleteHighlight(highlight);
  }

  private async getRoomOrThrow(roomId: string) {
    const room = await this.roomsRepository.getRoomById(roomId);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  private async requireRoomMember(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.roomsRepository.getMember(roomId, userId);

    if (!member) {
      throw new ForbiddenException('Only room members can access highlights');
    }
  }

  private toHighlightResponse(highlight: Highlight): HighlightResponse {
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

  private nowIsoString(): string {
    return new Date().toISOString();
  }
}
