export type ScheduledPartyStatus = 'scheduled' | 'started' | 'cancelled';

export interface ScheduledParty {
  scheduledPartyId: string;
  roomId: string;
  hostUserId: string;
  title: string;
  scheduledAt: string;
  status: ScheduledPartyStatus;
  createdAt: string;
}
