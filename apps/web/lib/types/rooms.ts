export interface Room {
  roomId: string;
  title: string;
  videoUrl: string | null;
  isPrivate: boolean;
  password?: string | null;
  hostUserId: string;
  memberCount: number;
  status: string;
  createdAt: string;
}

export interface RoomDetail {
  id: string;
  title: string;
  url: string;
  membersCount: number;
  hostId: string;
  isHost?: boolean;
}

export interface JoinRoomDetail {
  roomId: string;
  isPrivate: boolean;
}
