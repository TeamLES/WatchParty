import type { RoomMemberRole } from '../entities/room-member.entity';

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
