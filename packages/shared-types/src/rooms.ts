export type RoomStatus = "active" | "ended";

export type RoomMemberRole = "host" | "viewer";

export interface RoomMemberResponse {
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  nickname?: string | null;
}

export interface RoomSummaryResponse {
  roomId: string;
  title: string;
  videoUrl: string | null;
  isPrivate: boolean;
  password: string | null;
  hostUserId: string;
  memberCount: number;
  status: RoomStatus;
  createdAt: string;
}

export type CreateRoomResponse = RoomSummaryResponse;

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
