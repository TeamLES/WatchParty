import { Injectable, Logger } from '@nestjs/common';

import type { RoomInvite } from '../entities/room-invite.entity';
import type { RoomMember } from '../entities/room-member.entity';
import type { Room } from '../entities/room.entity';
import {
  RoomAlreadyExistsError,
  RoomCapacityExceededError,
  RoomMemberAlreadyExistsError,
  RoomMutationTargetMissingError,
  type RoomsRepository,
} from './rooms.repository';

@Injectable()
export class InMemoryRoomsRepository implements RoomsRepository {
  private readonly logger = new Logger(InMemoryRoomsRepository.name);
  private readonly roomsById = new Map<string, Room>();
  private readonly membersByRoomId = new Map<string, Map<string, RoomMember>>();
  private readonly invitesByRoomId = new Map<string, Map<string, RoomInvite>>();
  private readonly invitesByCode = new Map<string, RoomInvite>();

  constructor() {
    this.logger.log('driver=inmemory initialized');
  }

  createRoom(room: Room): Promise<Room> {
    this.logger.log(
      `createRoom roomId=${room.roomId} hostUserId=${room.hostUserId}`,
    );
    const existingRoom = this.roomsById.get(room.roomId);

    if (existingRoom) {
      throw new RoomAlreadyExistsError(room.roomId);
    }

    this.roomsById.set(room.roomId, this.cloneRoom(room));

    if (!this.membersByRoomId.has(room.roomId)) {
      this.membersByRoomId.set(room.roomId, new Map<string, RoomMember>());
    }

    if (!this.invitesByRoomId.has(room.roomId)) {
      this.invitesByRoomId.set(room.roomId, new Map<string, RoomInvite>());
    }

    return Promise.resolve(this.cloneRoom(room));
  }

  updateRoom(room: Room): Promise<Room> {
    this.logger.log(`updateRoom roomId=${room.roomId}`);
    if (!this.roomsById.has(room.roomId)) {
      throw new Error(`Room with roomId ${room.roomId} does not exist`);
    }

    this.roomsById.set(room.roomId, this.cloneRoom(room));
    return Promise.resolve(this.cloneRoom(room));
  }

  deleteRoom(roomId: string): Promise<void> {
    this.logger.log(`deleteRoom roomId=${roomId}`);
    this.roomsById.delete(roomId);
    this.membersByRoomId.delete(roomId);
    // Cleanup invites code index
    const roomInvites = this.invitesByRoomId.get(roomId);
    if (roomInvites) {
      for (const inviteCode of roomInvites.keys()) {
        this.invitesByCode.delete(inviteCode);
      }
    }
    this.invitesByRoomId.delete(roomId);

    return Promise.resolve();
  }

  listRooms(): Promise<Room[]> {
    this.logger.log('listRooms');

    return Promise.resolve(
      Array.from(this.roomsById.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((room) => this.cloneRoom(room)),
    );
  }

  getRoomById(roomId: string): Promise<Room | null> {
    this.logger.log(`getRoomById roomId=${roomId}`);
    const room = this.roomsById.get(roomId);
    this.logger.log(
      `getRoomById result roomId=${roomId} found=${Boolean(room)}`,
    );
    return Promise.resolve(room ? this.cloneRoom(room) : null);
  }

  joinMember(member: RoomMember): Promise<RoomMember> {
    this.logger.log(
      `joinMember roomId=${member.roomId} userId=${member.userId}`,
    );

    const room = this.roomsById.get(member.roomId);
    if (!room) {
      throw new RoomMutationTargetMissingError(member.roomId);
    }

    let roomMembers = this.membersByRoomId.get(member.roomId);
    if (!roomMembers) {
      roomMembers = new Map<string, RoomMember>();
      this.membersByRoomId.set(member.roomId, roomMembers);
    }

    if (roomMembers.has(member.userId)) {
      throw new RoomMemberAlreadyExistsError(member.roomId, member.userId);
    }

    if (
      room.maxCapacity !== undefined &&
      room.maxCapacity !== null &&
      room.activeWatcherCount >= room.maxCapacity
    ) {
      throw new RoomCapacityExceededError(member.roomId);
    }

    roomMembers.set(member.userId, this.cloneMember(member));
    this.roomsById.set(member.roomId, {
      ...this.cloneRoom(room),
      activeWatcherCount: room.activeWatcherCount + 1,
    });

    return Promise.resolve(this.cloneMember(member));
  }

  getMember(roomId: string, userId: string): Promise<RoomMember | null> {
    this.logger.log(`getMember roomId=${roomId} userId=${userId}`);
    const roomMembers = this.membersByRoomId.get(roomId);
    const member = roomMembers?.get(userId);
    return Promise.resolve(member ? this.cloneMember(member) : null);
  }

  updateMemberRole(
    roomId: string,
    userId: string,
    role: RoomMember['role'],
  ): Promise<RoomMember | null> {
    this.logger.log(
      `updateMemberRole roomId=${roomId} userId=${userId} role=${role}`,
    );
    const roomMembers = this.membersByRoomId.get(roomId);
    const member = roomMembers?.get(userId);

    if (!roomMembers || !member) {
      return Promise.resolve(null);
    }

    const updatedMember = {
      ...this.cloneMember(member),
      role,
    };
    roomMembers.set(userId, updatedMember);

    return Promise.resolve(this.cloneMember(updatedMember));
  }

  removeMember(roomId: string, userId: string): Promise<void> {
    this.logger.log(`removeMember roomId=${roomId} userId=${userId}`);
    const roomMembers = this.membersByRoomId.get(roomId);
    const room = this.roomsById.get(roomId);
    const member = roomMembers?.get(userId);

    if (roomMembers && room && member) {
      roomMembers.delete(userId);
      this.roomsById.set(roomId, {
        ...this.cloneRoom(room),
        activeWatcherCount: Math.max(0, room.activeWatcherCount - 1),
      });
    }

    return Promise.resolve();
  }

  getMembersByRoomId(roomId: string): Promise<RoomMember[]> {
    this.logger.log(`getMembersByRoomId roomId=${roomId}`);
    const roomMembers = this.membersByRoomId.get(roomId);

    if (!roomMembers) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      Array.from(roomMembers.values())
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
        .map((member) => this.cloneMember(member)),
    );
  }

  createInvite(invite: RoomInvite): Promise<RoomInvite> {
    let roomInvites = this.invitesByRoomId.get(invite.roomId);

    if (!roomInvites) {
      roomInvites = new Map<string, RoomInvite>();
      this.invitesByRoomId.set(invite.roomId, roomInvites);
    }

    const inviteCopy = this.cloneInvite(invite);
    roomInvites.set(invite.inviteCode, inviteCopy);
    this.invitesByCode.set(invite.inviteCode, inviteCopy);

    return Promise.resolve(this.cloneInvite(inviteCopy));
  }

  getInviteByCode(inviteCode: string): Promise<RoomInvite | null> {
    const invite = this.invitesByCode.get(inviteCode);
    return Promise.resolve(invite ? this.cloneInvite(invite) : null);
  }

  private cloneRoom(room: Room): Room {
    return { ...room };
  }

  private cloneMember(member: RoomMember): RoomMember {
    return { ...member };
  }

  private cloneInvite(invite: RoomInvite): RoomInvite {
    return { ...invite };
  }
}
