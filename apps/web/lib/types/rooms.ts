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
