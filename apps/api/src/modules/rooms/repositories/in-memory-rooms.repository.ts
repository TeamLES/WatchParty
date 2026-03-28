import { Injectable } from '@nestjs/common';

import type { RoomInvite } from '../entities/room-invite.entity';
import type { RoomMember } from '../entities/room-member.entity';
import type { Room } from '../entities/room.entity';
import {
  RoomAlreadyExistsError,
  type RoomsRepository,
} from './rooms.repository';

@Injectable()
export class InMemoryRoomsRepository implements RoomsRepository {
  private readonly roomsById = new Map<string, Room>();
  private readonly membersByRoomId = new Map<string, Map<string, RoomMember>>();
  private readonly invitesByRoomId = new Map<string, Map<string, RoomInvite>>();
  private readonly invitesByCode = new Map<string, RoomInvite>();

  async createRoom(room: Room): Promise<Room> {
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

    return this.cloneRoom(room);
  }

  async getRoomById(roomId: string): Promise<Room | null> {
    const room = this.roomsById.get(roomId);
    return room ? this.cloneRoom(room) : null;
  }

  async addMember(member: RoomMember): Promise<RoomMember> {
    let roomMembers = this.membersByRoomId.get(member.roomId);

    if (!roomMembers) {
      roomMembers = new Map<string, RoomMember>();
      this.membersByRoomId.set(member.roomId, roomMembers);
    }

    const existing = roomMembers.get(member.userId);
    if (existing) {
      return this.cloneMember(existing);
    }

    roomMembers.set(member.userId, this.cloneMember(member));
    return this.cloneMember(member);
  }

  async getMember(roomId: string, userId: string): Promise<RoomMember | null> {
    const roomMembers = this.membersByRoomId.get(roomId);
    const member = roomMembers?.get(userId);
    return member ? this.cloneMember(member) : null;
  }

  async getMembersByRoomId(roomId: string): Promise<RoomMember[]> {
    const roomMembers = this.membersByRoomId.get(roomId);

    if (!roomMembers) {
      return [];
    }

    return Array.from(roomMembers.values())
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map((member) => this.cloneMember(member));
  }

  async countMembers(roomId: string): Promise<number> {
    return this.membersByRoomId.get(roomId)?.size ?? 0;
  }

  async createInvite(invite: RoomInvite): Promise<RoomInvite> {
    let roomInvites = this.invitesByRoomId.get(invite.roomId);

    if (!roomInvites) {
      roomInvites = new Map<string, RoomInvite>();
      this.invitesByRoomId.set(invite.roomId, roomInvites);
    }

    const inviteCopy = this.cloneInvite(invite);
    roomInvites.set(invite.inviteCode, inviteCopy);
    this.invitesByCode.set(invite.inviteCode, inviteCopy);

    return this.cloneInvite(inviteCopy);
  }

  async getInviteByCode(inviteCode: string): Promise<RoomInvite | null> {
    const invite = this.invitesByCode.get(inviteCode);
    return invite ? this.cloneInvite(invite) : null;
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
