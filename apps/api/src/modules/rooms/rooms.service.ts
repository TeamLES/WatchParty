import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';

import { ROOMS_REPOSITORY } from './constants/rooms-repository.token';
import { CreateRoomInviteDto } from './dto/create-room-invite.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import type { RoomInvite } from './entities/room-invite.entity';
import type { RoomMember, RoomMemberRole } from './entities/room-member.entity';
import type { Room } from './entities/room.entity';
import {
  RoomAlreadyExistsError,
  type RoomsRepository,
} from './repositories/rooms.repository';

export interface RoomMemberResponse {
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
}

export interface CreateRoomResponse {
  roomId: string;
  title: string;
  videoUrl: string;
  hostUserId: string;
  memberCount: number;
  status: 'active';
  createdAt: string;
}

export interface GetRoomResponse extends CreateRoomResponse {
  members: RoomMemberResponse[];
  isHost: boolean;
  isMember: boolean;
}

export interface JoinRoomResponse {
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  alreadyMember: boolean;
}

export interface CreateRoomInviteResponse {
  roomId: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface GetRoomMembersResponse {
  roomId: string;
  memberCount: number;
  members: RoomMemberResponse[];
}

@Injectable()
export class RoomsService {
  constructor(
    @Inject(ROOMS_REPOSITORY)
    private readonly roomsRepository: RoomsRepository,
  ) {}

  async createRoom(
    userId: string,
    createRoomDto: CreateRoomDto,
  ): Promise<CreateRoomResponse> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const createdAt = this.nowIsoString();
      const room: Room = {
        roomId: this.generateRoomId(),
        title: createRoomDto.title,
        videoUrl: createRoomDto.videoUrl,
        hostUserId: userId,
        status: 'active',
        createdAt,
      };

      const hostMember: RoomMember = {
        roomId: room.roomId,
        userId,
        role: 'host',
        joinedAt: createdAt,
      };

      try {
        await this.roomsRepository.createRoom(room);
        await this.roomsRepository.addMember(hostMember);

        return {
          roomId: room.roomId,
          title: room.title,
          videoUrl: room.videoUrl,
          hostUserId: room.hostUserId,
          memberCount: 1,
          status: room.status,
          createdAt: room.createdAt,
        };
      } catch (error) {
        if (error instanceof RoomAlreadyExistsError && attempt < maxAttempts) {
          continue;
        }

        throw error;
      }
    }

    throw new Error('Failed to allocate a unique roomId');
  }

  async getRoom(roomId: string, userId: string): Promise<GetRoomResponse> {
    const room = await this.getRoomOrThrow(roomId);
    const members = await this.roomsRepository.getMembersByRoomId(roomId);
    const memberCount = members.length;
    const isHost = room.hostUserId === userId;
    const isMember = members.some((member) => member.userId === userId);

    return {
      roomId: room.roomId,
      title: room.title,
      videoUrl: room.videoUrl,
      hostUserId: room.hostUserId,
      memberCount,
      status: room.status,
      createdAt: room.createdAt,
      members: members.map((member) => this.toRoomMemberResponse(member)),
      isHost,
      isMember,
    };
  }

  async joinRoom(roomId: string, userId: string): Promise<JoinRoomResponse> {
    const room = await this.getRoomOrThrow(roomId);
    const existingMember = await this.roomsRepository.getMember(roomId, userId);

    if (existingMember) {
      return {
        roomId,
        userId: existingMember.userId,
        role: existingMember.role,
        joinedAt: existingMember.joinedAt,
        alreadyMember: true,
      };
    }

    const member: RoomMember = {
      roomId,
      userId,
      role: room.hostUserId === userId ? 'host' : 'viewer',
      joinedAt: this.nowIsoString(),
    };

    const addedMember = await this.roomsRepository.addMember(member);

    return {
      roomId,
      userId: addedMember.userId,
      role: addedMember.role,
      joinedAt: addedMember.joinedAt,
      alreadyMember: false,
    };
  }

  async createInvite(
    roomId: string,
    userId: string,
    createRoomInviteDto: CreateRoomInviteDto,
  ): Promise<CreateRoomInviteResponse> {
    const room = await this.getRoomOrThrow(roomId);

    if (room.hostUserId !== userId) {
      throw new ForbiddenException('Only the room host can create invites');
    }

    const expiresAt = this.normalizeExpiresAt(createRoomInviteDto.expiresAt);
    const invite: RoomInvite = {
      roomId,
      inviteCode: this.generateInviteCode(),
      createdBy: userId,
      createdAt: this.nowIsoString(),
      ...(expiresAt ? { expiresAt } : {}),
    };

    const createdInvite = await this.roomsRepository.createInvite(invite);

    return {
      roomId: createdInvite.roomId,
      inviteCode: createdInvite.inviteCode,
      createdBy: createdInvite.createdBy,
      createdAt: createdInvite.createdAt,
      expiresAt: createdInvite.expiresAt ?? null,
    };
  }

  async getRoomMembers(roomId: string): Promise<GetRoomMembersResponse> {
    await this.getRoomOrThrow(roomId);
    const members = await this.roomsRepository.getMembersByRoomId(roomId);

    return {
      roomId,
      memberCount: members.length,
      members: members.map((member) => this.toRoomMemberResponse(member)),
    };
  }

  private async getRoomOrThrow(roomId: string): Promise<Room> {
    const room = await this.roomsRepository.getRoomById(roomId);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  private normalizeExpiresAt(expiresAtInput?: string): string | undefined {
    if (!expiresAtInput) {
      return undefined;
    }

    const expiresAtDate = new Date(expiresAtInput);
    if (Number.isNaN(expiresAtDate.getTime())) {
      throw new BadRequestException('expiresAt must be a valid ISO date-time');
    }

    if (expiresAtDate.getTime() <= Date.now()) {
      throw new BadRequestException('expiresAt must be in the future');
    }

    return expiresAtDate.toISOString();
  }

  private toRoomMemberResponse(member: RoomMember): RoomMemberResponse {
    return {
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
    };
  }

  private nowIsoString(): string {
    return new Date().toISOString();
  }

  private generateRoomId(): string {
    return randomBytes(8).toString('hex');
  }

  private generateInviteCode(): string {
    return randomBytes(6).toString('hex');
  }
}
