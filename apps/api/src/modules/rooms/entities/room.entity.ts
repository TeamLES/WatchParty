export type RoomStatus = 'active';
export type RoomVisibilityStatus = 'public' | 'private';

export interface Room {
  roomId: string;
  title: string;
  videoUrl?: string;
  videoProvider?: string;
  videoId?: string;
  isPrivate: boolean;
  password?: string;
  visibilityStatus?: RoomVisibilityStatus;
  hostUserId: string;
  status: RoomStatus;
  createdAt: string;
  updatedAt?: string;
}
