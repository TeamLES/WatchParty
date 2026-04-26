export type RoomStatus = 'active' | 'ended' | 'scheduled';

export interface Room {
  roomId: string;
  hostUserId: string;
  title: string;
  videoUrl: string;
  videoProvider?: string;
  videoId?: string;
  status: RoomStatus;
  isPrivate: boolean;
  visibilityStatus: string;
  createdAt: string;
  updatedAt: string;
}
