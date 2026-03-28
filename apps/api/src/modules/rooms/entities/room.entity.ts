export type RoomStatus = 'active';

export interface Room {
  roomId: string;
  title: string;
  videoUrl: string;
  hostUserId: string;
  status: RoomStatus;
  createdAt: string;
}
