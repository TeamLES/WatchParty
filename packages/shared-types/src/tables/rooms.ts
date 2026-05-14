export type RoomStatus = "active";

export type RoomVisibilityStatus = "public" | "private";

export interface Room {
  roomId: string;
  hostUserId: string;
  coHostUserId?: string | null;
  title: string;
  videoUrl?: string;
  status: RoomStatus;
  isPrivate: boolean;
  password?: string;
  visibilityStatus: RoomVisibilityStatus;
  maxCapacity?: number | null;
  activeWatcherCount: number;
  createdAt: string;
  updatedAt: string;
}
