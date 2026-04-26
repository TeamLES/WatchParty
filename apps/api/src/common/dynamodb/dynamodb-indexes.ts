export const DYNAMODB_INDEXES = {
  users: {
    email: 'email-index',
  },
  rooms: {
    host: 'host-index',
    visibility: 'visibility-index',
  },
  roomMembers: {
    userRooms: 'user-rooms-index',
  },
  invites: {
    room: 'room-index',
  },
  chatMessages: {
    sender: 'sender-index',
  },
  websocketConnections: {
    room: 'room-index',
    user: 'user-index',
  },
  reactionEvents: {
    user: 'user-index',
  },
  scheduledParties: {
    hostSchedule: 'host-schedule-index',
    roomSchedule: 'room-schedule-index',
  },
} as const;
