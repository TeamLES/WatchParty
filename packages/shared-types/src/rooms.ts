export type RoomStatus = "active" | "ended";

export type RoomMemberRole = "host" | "co-host" | "viewer";

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
  coHostUserId: string | null;
  maxCapacity: number | null;
  activeWatcherCount: number;
  onlineCount?: number | null;
  status: RoomStatus;
  createdAt: string;
}

export type CreateRoomResponse = RoomSummaryResponse;

export interface GetRoomResponse extends RoomSummaryResponse {
  members: RoomMemberResponse[];
  isHost: boolean;
  isCoHost: boolean;
  isController: boolean;
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
  activeWatcherCount: number;
  members: RoomMemberResponse[];
}
