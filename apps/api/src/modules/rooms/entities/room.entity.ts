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
  coHostUserId?: string | null;
  maxCapacity?: number | null;
  activeWatcherCount: number;
  status: RoomStatus;
  createdAt: string;
  updatedAt?: string;
}
