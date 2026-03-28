import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';

import { ROOMS_REPOSITORY } from './constants/rooms-repository.token';
import { CreateRoomInviteDto } from './dto/create-room-invite.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
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

export interface RoomSummaryResponse {
  roomId: string;
  title: string;
  videoUrl: string | null;
  isPrivate: boolean;
  password: string | null;
  hostUserId: string;
  memberCount: number;
  status: 'active';
  createdAt: string;
}

export interface CreateRoomResponse extends RoomSummaryResponse {}

export interface GetRoomResponse extends RoomSummaryResponse {
  members: RoomMemberResponse[];
  isHost: boolean;
  isMember: boolean;
}

export type GetRoomsResponse = RoomSummaryResponse[];

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
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @Inject(ROOMS_REPOSITORY)
    private readonly roomsRepository: RoomsRepository,
  ) {
    this.logger.log(
      `initialized repository=${this.roomsRepository.constructor.name}`,
    );
  }

  async createRoom(
    userId: string,
    createRoomDto: CreateRoomDto,
  ): Promise<CreateRoomResponse> {
    this.logger.log(`createRoom userId=${userId}`);
    const maxAttempts = 3;
    const isPrivate = createRoomDto.isPrivate === true;
    const password = createRoomDto.password;

    if (isPrivate && !password) {
      throw new BadRequestException(
        'password is required when isPrivate is true',
      );
    }

    if (!isPrivate && password) {
      throw new BadRequestException(
        'password can be provided only when isPrivate is true',
      );
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const createdAt = this.nowIsoString();
      const room: Room = {
        roomId: this.generateRoomId(),
        title: createRoomDto.title,
        ...(createRoomDto.videoUrl ? { videoUrl: createRoomDto.videoUrl } : {}),
        isPrivate,
        ...(password ? { password } : {}),
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

        this.logger.log(
          `createRoom success roomId=${room.roomId} host=${userId}`,
        );

        return this.toRoomSummaryResponse(room, 1);
      } catch (error) {
        if (error instanceof RoomAlreadyExistsError && attempt < maxAttempts) {
          this.logger.warn(
            `createRoom collision roomId=${room.roomId} attempt=${attempt}`,
          );
          continue;
        }

        throw error;
      }
    }

    throw new Error('Failed to allocate a unique roomId');
  }

  async updateRoom(
    roomId: string,
    userId: string,
    updateRoomDto: UpdateRoomDto,
  ): Promise<GetRoomResponse> {
    this.logger.log(`updateRoom roomId=${roomId} userId=${userId}`);
    const room = await this.getRoomOrThrow(roomId);

    if (room.hostUserId !== userId) {
      throw new ForbiddenException('Only the host can update the room');
    }

    const isPrivate = updateRoomDto.isPrivate ?? room.isPrivate;
    const password = updateRoomDto.password ?? room.password;

    if (isPrivate && !password) {
      throw new BadRequestException(
        'password is required when isPrivate is true',
      );
    }

    if (!isPrivate && password) {
      throw new BadRequestException(
        'password can be provided only when isPrivate is true',
      );
    }

    const updatedRoom: Room = {
      ...room,
      ...(updateRoomDto.title !== undefined
        ? { title: updateRoomDto.title }
        : {}),
      ...(updateRoomDto.videoUrl !== undefined
        ? { videoUrl: updateRoomDto.videoUrl }
        : {}),
      isPrivate,
      ...(password !== undefined ? { password } : {}),
    };

    if (!isPrivate) {
      delete updatedRoom.password;
    }

    // In order for videoUrl to be updated to null/undefined we must allow clearing it.
    // updateRoomDto doesn't permit null right now based on CreateRoomDto, but we map undefined.

    await this.roomsRepository.updateRoom(updatedRoom);

    return this.getRoom(roomId, userId);
  }

  async deleteRoom(roomId: string, userId: string): Promise<void> {
    this.logger.log(`deleteRoom roomId=${roomId} userId=${userId}`);
    const room = await this.getRoomOrThrow(roomId);

    if (room.hostUserId !== userId) {
      throw new ForbiddenException('Only the host can delete the room');
    }

    await this.roomsRepository.deleteRoom(roomId);
    this.logger.log(`deleteRoom success roomId=${roomId} userId=${userId}`);
  }

  async getRooms(): Promise<GetRoomsResponse> {
    this.logger.log('getRooms');
    const rooms = await this.roomsRepository.listRooms();

    const roomSummaries = await Promise.all(
      rooms.map(async (room) => {
        const memberCount = await this.roomsRepository.countMembers(
          room.roomId,
        );
        return this.toRoomSummaryResponse(room, memberCount);
      }),
    );

    return roomSummaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getRoom(roomId: string, userId: string): Promise<GetRoomResponse> {
    this.logger.log(`getRoom roomId=${roomId} userId=${userId}`);
    const room = await this.getRoomOrThrow(roomId);
    const members = await this.roomsRepository.getMembersByRoomId(roomId);
    const memberCount = members.length;
    const isHost = room.hostUserId === userId;
    const isMember = members.some((member) => member.userId === userId);

    return {
      ...this.toRoomSummaryResponse(room, memberCount),
      members: members.map((member) => this.toRoomMemberResponse(member)),
      isHost,
      isMember,
    };
  }

  async joinRoom(
    roomId: string,
    userId: string,
    joinRoomDto: JoinRoomDto,
  ): Promise<JoinRoomResponse> {
    this.logger.log(`joinRoom roomId=${roomId} userId=${userId}`);
    const room = await this.getRoomOrThrow(roomId);
    const existingMember = await this.roomsRepository.getMember(roomId, userId);

    if (existingMember) {
      this.logger.log(
        `joinRoom alreadyMember roomId=${roomId} userId=${userId}`,
      );
      return {
        roomId,
        userId: existingMember.userId,
        role: existingMember.role,
        joinedAt: existingMember.joinedAt,
        alreadyMember: true,
      };
    }

    if (room.isPrivate && room.hostUserId !== userId) {
      if (room.password !== joinRoomDto?.password) {
        throw new ForbiddenException('Invalid password for private room');
      }
    }

    const member: RoomMember = {
      roomId,
      userId,
      role: room.hostUserId === userId ? 'host' : 'viewer',
      joinedAt: this.nowIsoString(),
    };

    const addedMember = await this.roomsRepository.addMember(member);

    this.logger.log(`joinRoom success roomId=${roomId} userId=${userId}`);

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
      this.logger.warn(`getRoomOrThrow notFound roomId=${roomId}`);
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

  private toRoomSummaryResponse(
    room: Room,
    memberCount: number,
  ): RoomSummaryResponse {
    return {
      roomId: room.roomId,
      title: room.title,
      videoUrl: room.videoUrl ?? null,
      isPrivate: room.isPrivate,
      password: room.password ?? null,
      hostUserId: room.hostUserId,
      memberCount,
      status: room.status,
      createdAt: room.createdAt,
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
