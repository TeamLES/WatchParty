import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';

import type {
  CreateRoomInviteResponse,
  CreateRoomResponse,
  GetRoomMembersResponse,
  GetRoomResponse,
  GetRoomsResponse,
  JoinRoomResponse,
  RoomMemberResponse,
  RoomSummaryResponse,
} from '@watchparty/shared-types';
import { RealtimePresenceService } from '../realtime/realtime-presence.service';
import { ROOMS_REPOSITORY } from './constants/rooms-repository.token';
import type { CreateRoomInviteDto } from './dto/create-room-invite.dto';
import type { CreateRoomDto } from './dto/create-room.dto';
import type { JoinRoomDto } from './dto/join-room.dto';
import type { UpdateRoomDto } from './dto/update-room.dto';
import type { RoomInvite } from './entities/room-invite.entity';
import type { RoomMember } from './entities/room-member.entity';
import type { Room } from './entities/room.entity';
import {
  RoomAlreadyExistsError,
  type RoomsRepository,
} from './repositories/rooms.repository';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @Inject(ROOMS_REPOSITORY)
    private readonly roomsRepository: RoomsRepository,
    private readonly realtimePresenceService: RealtimePresenceService,
  ) {
    this.logger.log(
      `initialized repository=${this.roomsRepository.constructor.name}`,
    );
  }

  async createRoom(
    userId: string,
    createRoomDto: CreateRoomDto,
    nickname?: string,
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
        visibilityStatus: isPrivate ? 'private' : 'public',
        hostUserId: userId,
        status: 'active',
        createdAt,
        updatedAt: createdAt,
      };

      const hostMember: RoomMember = {
        roomId: room.roomId,
        userId,
        role: 'host',
        joinedAt: createdAt,
        ...(nickname ? { nickname } : {}),
      };

      try {
        await this.roomsRepository.createRoom(room);
        await this.roomsRepository.addMember(hostMember);

        this.logger.log(
          `createRoom success roomId=${room.roomId} host=${userId}`,
        );

        return this.toRoomSummaryResponse(room, 1, null);
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
      visibilityStatus: isPrivate ? 'private' : 'public',
      updatedAt: this.nowIsoString(),
    };

    if (!isPrivate) {
      delete updatedRoom.password;
    }

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
        const [memberCount, onlineCount] = await Promise.all([
          this.roomsRepository.countMembers(room.roomId),
          this.realtimePresenceService.countOnlineByRoom(room.roomId),
        ]);

        return this.toRoomSummaryResponse(room, memberCount, onlineCount);
      }),
    );

    return roomSummaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getRoom(roomId: string, userId: string): Promise<GetRoomResponse> {
    this.logger.log(`getRoom roomId=${roomId} userId=${userId}`);
    const room = await this.getRoomOrThrow(roomId);
    const [members, onlineCount] = await Promise.all([
      this.roomsRepository.getMembersByRoomId(roomId),
      this.realtimePresenceService.countOnlineByRoom(roomId),
    ]);
    const memberCount = members.length;
    const isHost = room.hostUserId === userId;
    const isMember = members.some((member) => member.userId === userId);

    return {
      ...this.toRoomSummaryResponse(room, memberCount, onlineCount),
      members: members.map((member) => this.toRoomMemberResponse(member)),
      isHost,
      isMember,
    };
  }

  async joinRoom(
    roomId: string,
    userId: string,
    joinRoomDto: JoinRoomDto,
    nickname?: string,
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

    if (room.isPrivate) {
      const providedPassword = joinRoomDto?.password?.trim() ?? '';
      const storedPassword = room.password ?? '';

      if (!providedPassword || providedPassword !== storedPassword) {
        throw new ForbiddenException('Invalid password for private room');
      }
    }

    const member: RoomMember = {
      roomId,
      userId,
      role: room.hostUserId === userId ? 'host' : 'viewer',
      joinedAt: this.nowIsoString(),
      ...(nickname ? { nickname } : {}),
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

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    this.logger.log(`leaveRoom roomId=${roomId} userId=${userId}`);
    const room = await this.getRoomOrThrow(roomId);

    if (room.hostUserId === userId) {
      throw new ForbiddenException(
        'Host cannot leave the room, must delete it instead',
      );
    }

    const member = await this.roomsRepository.getMember(roomId, userId);
    if (!member) {
      this.logger.warn(
        `leaveRoom not a member roomId=${roomId} userId=${userId}`,
      );
      return;
    }

    await this.roomsRepository.removeMember(roomId, userId);
    this.logger.log(`leaveRoom success roomId=${roomId} userId=${userId}`);
  }

  async kickMember(
    roomId: string,
    hostUserId: string,
    memberUserId: string,
  ): Promise<void> {
    this.logger.log(
      `kickMember roomId=${roomId} hostUserId=${hostUserId} memberUserId=${memberUserId}`,
    );
    const room = await this.getRoomOrThrow(roomId);

    if (room.hostUserId !== hostUserId) {
      throw new ForbiddenException('Only the host can kick members');
    }

    if (memberUserId === room.hostUserId) {
      throw new BadRequestException('Host cannot be kicked from the room');
    }

    const member = await this.roomsRepository.getMember(roomId, memberUserId);

    if (!member) {
      throw new NotFoundException('Member not found in this room');
    }

    await this.roomsRepository.removeMember(roomId, memberUserId);
    this.logger.log(
      `kickMember success roomId=${roomId} hostUserId=${hostUserId} memberUserId=${memberUserId}`,
    );
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
      nickname: member.nickname ?? null,
    };
  }

  private toRoomSummaryResponse(
    room: Room,
    memberCount: number,
    onlineCount: number | null,
  ): RoomSummaryResponse {
    return {
      roomId: room.roomId,
      title: room.title,
      videoUrl: room.videoUrl ?? null,
      isPrivate: room.isPrivate,
      password: room.password ?? null,
      hostUserId: room.hostUserId,
      memberCount,
      onlineCount,
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
