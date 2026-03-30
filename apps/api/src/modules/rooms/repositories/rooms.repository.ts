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
  updateRoom(room: Room): Promise<Room>;
  deleteRoom(roomId: string): Promise<void>;
  listRooms(): Promise<Room[]>;

  // Room lookup must be scoped only by roomId, never by current user.
  getRoomById(roomId: string): Promise<Room | null>;

  addMember(member: RoomMember): Promise<RoomMember>;
  getMember(roomId: string, userId: string): Promise<RoomMember | null>;
  removeMember(roomId: string, userId: string): Promise<void>;

  // Members lookup must stay in the room partition (PK=ROOM#<roomId>).
  getMembersByRoomId(roomId: string): Promise<RoomMember[]>;
  countMembers(roomId: string): Promise<number>;

  createInvite(invite: RoomInvite): Promise<RoomInvite>;
  getInviteByCode(inviteCode: string): Promise<RoomInvite | null>;
}
