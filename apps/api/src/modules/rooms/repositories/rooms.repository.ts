import type { RoomInvite } from '../entities/room-invite.entity';
import type { RoomMember } from '../entities/room-member.entity';
import type { Room } from '../entities/room.entity';

export class RoomAlreadyExistsError extends Error {
  constructor(public readonly roomId: string) {
    super(`Room with roomId ${roomId} already exists`);
  }
}

export interface RoomsRepository {
  createRoom(room: Room): Promise<Room>;
  getRoomById(roomId: string): Promise<Room | null>;

  addMember(member: RoomMember): Promise<RoomMember>;
  getMember(roomId: string, userId: string): Promise<RoomMember | null>;
  getMembersByRoomId(roomId: string): Promise<RoomMember[]>;
  countMembers(roomId: string): Promise<number>;

  createInvite(invite: RoomInvite): Promise<RoomInvite>;
  getInviteByCode(inviteCode: string): Promise<RoomInvite | null>;
}
