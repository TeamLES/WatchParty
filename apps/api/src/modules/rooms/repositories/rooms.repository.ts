import type { RoomInvite } from '../entities/room-invite.entity';
import type { RoomMember } from '../entities/room-member.entity';
import type { Room } from '../entities/room.entity';

export class RoomAlreadyExistsError extends Error {
  constructor(public readonly roomId: string) {
    super(`Room with roomId ${roomId} already exists`);
  }
}

export class RoomCapacityExceededError extends Error {
  constructor(public readonly roomId: string) {
    super(`Room with roomId ${roomId} has reached its capacity`);
  }
}

export class RoomMemberAlreadyExistsError extends Error {
  constructor(
    public readonly roomId: string,
    public readonly userId: string,
  ) {
    super(`User ${userId} is already a member of room ${roomId}`);
  }
}

export class RoomMutationTargetMissingError extends Error {
  constructor(public readonly roomId: string) {
    super(`Room with roomId ${roomId} no longer exists`);
  }
}

export interface RoomsRepository {
  createRoom(room: Room): Promise<Room>;
  updateRoom(room: Room): Promise<Room>;
  deleteRoom(roomId: string): Promise<void>;
  listRooms(): Promise<Room[]>;

  // Room lookup must be scoped only by roomId, never by current user.
  getRoomById(roomId: string): Promise<Room | null>;

  joinMember(member: RoomMember): Promise<RoomMember>;
  getMember(roomId: string, userId: string): Promise<RoomMember | null>;
  updateMemberRole(
    roomId: string,
    userId: string,
    role: RoomMember['role'],
  ): Promise<RoomMember | null>;
  removeMember(roomId: string, userId: string): Promise<void>;

  // Members lookup is scoped by roomId in the room-members table.
  getMembersByRoomId(roomId: string): Promise<RoomMember[]>;
  createInvite(invite: RoomInvite): Promise<RoomInvite>;
  getInviteByCode(inviteCode: string): Promise<RoomInvite | null>;
}
