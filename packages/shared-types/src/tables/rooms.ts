export type RoomStatus = 'active';

export type RoomVisibilityStatus = 'public' | 'private';

export interface Room {
  roomId: string;
  hostUserId: string;
  title: string;
  videoUrl?: string;
  status: RoomStatus;
  isPrivate: boolean;
  password?: string;
  visibilityStatus: RoomVisibilityStatus;
  createdAt: string;
  updatedAt: string;
}
