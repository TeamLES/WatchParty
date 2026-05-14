import {
  BadRequestException,
  ConflictException,
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
  RoomMemberRole,
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
  RoomCapacityExceededError,
  RoomMemberAlreadyExistsError,
  RoomMutationTargetMissingError,
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
        coHostUserId: null,
        ...(createRoomDto.maxCapacity !== undefined
          ? { maxCapacity: createRoomDto.maxCapacity }
          : {}),
        activeWatcherCount: 0,
        status: 'active',
        createdAt,
        updatedAt: createdAt,
      };

      try {
        await this.roomsRepository.createRoom(room);

        this.logger.log(
          `createRoom success roomId=${room.roomId} host=${userId}`,
        );

        return this.toRoomSummaryResponse(room, null);
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
        const onlineCount =
          await this.realtimePresenceService.countOnlineByRoom(room.roomId);

        return this.toRoomSummaryResponse(room, onlineCount);
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
    const isHost = room.hostUserId === userId;
    const isCoHost = room.coHostUserId === userId;
    const isMember = members.some((member) => member.userId === userId);

    return {
      ...this.toRoomSummaryResponse(room, onlineCount),
      members: members.map((member) => this.toRoomMemberResponse(member)),
      isHost,
      isCoHost,
      isController: isHost || isCoHost,
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

    const isHostJoiningOwnRoom = room.hostUserId === userId;

    if (room.isPrivate && !isHostJoiningOwnRoom) {
      const providedPassword = joinRoomDto?.password?.trim() ?? '';
      const storedPassword = room.password ?? '';

      if (!providedPassword || providedPassword !== storedPassword) {
        throw new ForbiddenException('Invalid password for private room');
      }
    }

    const member: RoomMember = {
      roomId,
      userId,
      role: isHostJoiningOwnRoom ? 'host' : 'viewer',
      joinedAt: this.nowIsoString(),
      ...(nickname ? { nickname } : {}),
    };

    let addedMember: RoomMember;

    try {
      addedMember = await this.roomsRepository.joinMember(member);
    } catch (error) {
      if (error instanceof RoomMemberAlreadyExistsError) {
        const concurrentExistingMember = await this.roomsRepository.getMember(
          roomId,
          userId,
        );

        if (concurrentExistingMember) {
          return {
            roomId,
            userId: concurrentExistingMember.userId,
            role: concurrentExistingMember.role,
            joinedAt: concurrentExistingMember.joinedAt,
            alreadyMember: true,
          };
        }
      }

      if (error instanceof RoomCapacityExceededError) {
        throw new ConflictException({
          code: 'ROOM_CAPACITY_EXCEEDED',
          message: 'Room is full.',
        });
      }

      if (error instanceof RoomMutationTargetMissingError) {
        throw new NotFoundException('Room not found');
      }

      throw error;
    }

    this.logger.log(`joinRoom success roomId=${roomId} userId=${userId}`);
    await this.ensureRoomHasController(roomId);

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
    await this.getRoomOrThrow(roomId);

    const member = await this.roomsRepository.getMember(roomId, userId);
    if (!member) {
      this.logger.warn(
        `leaveRoom not a member roomId=${roomId} userId=${userId}`,
      );
      return;
    }

    await this.roomsRepository.removeMember(roomId, userId);
    await this.ensureRoomHasController(roomId);
    this.logger.log(`leaveRoom success roomId=${roomId} userId=${userId}`);
  }

  async kickMember(
    roomId: string,
    actorUserId: string,
    memberUserId: string,
  ): Promise<void> {
    this.logger.log(
      `kickMember roomId=${roomId} actorUserId=${actorUserId} memberUserId=${memberUserId}`,
    );
    const room = await this.getRoomOrThrow(roomId);
    const actorMember = await this.roomsRepository.getMember(
      roomId,
      actorUserId,
    );
    const isHostActor = room.hostUserId === actorUserId;
    const isCoHostActor = room.coHostUserId === actorUserId;

    if (!isHostActor && !isCoHostActor) {
      throw new ForbiddenException('Only room controllers can kick members');
    }

    if (!isHostActor && !actorMember) {
      throw new ForbiddenException(
        'Only active room controllers can kick members',
      );
    }

    if (memberUserId === room.hostUserId) {
      throw new BadRequestException('Host cannot be kicked from the room');
    }

    const member = await this.roomsRepository.getMember(roomId, memberUserId);

    if (!member) {
      throw new NotFoundException('Member not found in this room');
    }

    if (member.userId === actorUserId) {
      throw new BadRequestException('You cannot kick yourself from the room');
    }

    if (isCoHostActor && member.role === 'co-host') {
      throw new ForbiddenException('Co-host cannot kick another co-host');
    }

    await this.roomsRepository.removeMember(roomId, memberUserId);
    await this.ensureRoomHasController(roomId);
    this.logger.log(
      `kickMember success roomId=${roomId} actorUserId=${actorUserId} memberUserId=${memberUserId}`,
    );
  }

  async setCoHost(
    roomId: string,
    actorUserId: string,
    requestedUserId?: string | null,
  ): Promise<GetRoomResponse> {
    this.logger.log(
      `setCoHost roomId=${roomId} actorUserId=${actorUserId} requestedUserId=${requestedUserId ?? '(random)'}`,
    );
    const room = await this.getRoomOrThrow(roomId);

    if (room.hostUserId !== actorUserId) {
      throw new ForbiddenException('Only the host can set a co-host');
    }

    const targetUserId = requestedUserId?.trim() || null;

    if (targetUserId === room.hostUserId) {
      throw new BadRequestException('Host is already the room controller');
    }

    const members = await this.roomsRepository.getMembersByRoomId(roomId);
    const targetMember = targetUserId
      ? members.find((member) => member.userId === targetUserId)
      : await this.pickEligibleCoHost(room, members);

    if (targetUserId && !targetMember) {
      throw new NotFoundException('Member not found in this room');
    }

    const updatedRoom = await this.applyCoHostSelection(
      room,
      members,
      targetMember?.userId ?? null,
    );

    return this.getRoom(updatedRoom.roomId, actorUserId);
  }

  async isRoomController(roomId: string, userId: string): Promise<boolean> {
    const room = await this.getRoomOrThrow(roomId);

    return room.hostUserId === userId || room.coHostUserId === userId;
  }

  async ensureRoomHasController(roomId: string): Promise<Room> {
    const room = await this.getRoomOrThrow(roomId);
    const members = await this.roomsRepository.getMembersByRoomId(roomId);

    if (members.length === 0) {
      return this.applyCoHostSelection(room, members, null);
    }

    const activeMembers = await this.getActiveMembers(roomId, members);
    const hostOnline = activeMembers.some(
      (member) => member.userId === room.hostUserId,
    );
    const coHostOnline =
      room.coHostUserId !== undefined &&
      room.coHostUserId !== null &&
      activeMembers.some((member) => member.userId === room.coHostUserId);

    if (hostOnline || coHostOnline) {
      await this.normalizeMemberRoles(room, members, room.coHostUserId ?? null);
      return room;
    }

    const targetMember = await this.pickEligibleCoHost(room, activeMembers);

    return this.applyCoHostSelection(
      room,
      members,
      targetMember?.userId ?? null,
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
    const room = await this.getRoomOrThrow(roomId);
    const members = await this.roomsRepository.getMembersByRoomId(roomId);

    return {
      roomId,
      activeWatcherCount: room.activeWatcherCount,
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
    onlineCount: number | null,
  ): RoomSummaryResponse {
    return {
      roomId: room.roomId,
      title: room.title,
      videoUrl: room.videoUrl ?? null,
      isPrivate: room.isPrivate,
      password: room.password ?? null,
      hostUserId: room.hostUserId,
      coHostUserId: room.coHostUserId ?? null,
      maxCapacity: room.maxCapacity ?? null,
      activeWatcherCount: room.activeWatcherCount,
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

  private async getActiveMembers(
    roomId: string,
    members: RoomMember[],
  ): Promise<RoomMember[]> {
    const onlineUserIds =
      await this.realtimePresenceService.listOnlineUserIdsByRoom(roomId);

    if (onlineUserIds === null) {
      return members;
    }

    return members.filter((member) =>
      onlineUserIds.has(member.userId),
    );
  }

  private pickEligibleCoHost(
    room: Room,
    members: RoomMember[],
  ): RoomMember | null {
    const eligibleMembers = members.filter(
      (member) => member.userId !== room.hostUserId && member.role !== 'host',
    );

    if (eligibleMembers.length === 0) {
      return null;
    }

    return eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)];
  }

  private async applyCoHostSelection(
    room: Room,
    members: RoomMember[],
    coHostUserId: string | null,
  ): Promise<Room> {
    const updatedRoom: Room = {
      ...room,
      coHostUserId,
      updatedAt: this.nowIsoString(),
    };

    await this.roomsRepository.updateRoom(updatedRoom);
    await this.normalizeMemberRoles(updatedRoom, members, coHostUserId);
    await this.broadcastRoomRoleUpdated(updatedRoom, members, coHostUserId);

    return updatedRoom;
  }

  private async normalizeMemberRoles(
    room: Room,
    members: RoomMember[],
    coHostUserId: string | null,
  ): Promise<void> {
    await Promise.all(
      members.map((member) => {
        const nextRole = this.resolveMemberRole(
          room.hostUserId,
          coHostUserId,
          member.userId,
        );

        if (member.role === nextRole) {
          return Promise.resolve(null);
        }

        return this.roomsRepository.updateMemberRole(
          member.roomId,
          member.userId,
          nextRole,
        );
      }),
    );
  }

  private resolveMemberRole(
    hostUserId: string,
    coHostUserId: string | null,
    memberUserId: string,
  ): RoomMemberRole {
    if (memberUserId === hostUserId) {
      return 'host';
    }

    if (coHostUserId && memberUserId === coHostUserId) {
      return 'co-host';
    }

    return 'viewer';
  }

  private async broadcastRoomRoleUpdated(
    room: Room,
    members: RoomMember[],
    coHostUserId: string | null,
  ): Promise<void> {
    await this.realtimePresenceService.broadcastToRoom(room.roomId, {
      type: 'room_role_updated',
      roomId: room.roomId,
      hostUserId: room.hostUserId,
      coHostUserId,
      members: members.map((member) =>
        this.toRoomMemberResponse({
          ...member,
          role: this.resolveMemberRole(
            room.hostUserId,
            coHostUserId,
            member.userId,
          ),
        }),
      ),
      updatedAt: this.nowIsoString(),
    });
  }
}
