import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import type { RealtimePresenceService } from '../realtime/realtime-presence.service';
import type { Room } from './entities/room.entity';
import type { RoomInvite } from './entities/room-invite.entity';
import type { RoomMember } from './entities/room-member.entity';
import {
  ReminderClaimConflictError,
  type RoomsRepository,
} from './repositories/rooms.repository';
import { RoomsService } from './rooms.service';
import {
  ScheduledPartyEmailService,
  type SendScheduledPartyReminderEmailParams,
} from './scheduled-party-email.service';
import { ScheduledPartyReminderWorker } from './scheduled-party-reminder.worker';

class FakeRoomsRepository implements RoomsRepository {
  readonly rooms = new Map<string, Room>();
  readonly members = new Map<string, Map<string, RoomMember>>();

  createRoom(room: Room): Promise<Room> {
    this.rooms.set(room.roomId, { ...room });
    return Promise.resolve({ ...room });
  }

  updateRoom(room: Room): Promise<Room> {
    this.rooms.set(room.roomId, { ...room });
    return Promise.resolve({ ...room });
  }

  deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    this.members.delete(roomId);
    return Promise.resolve();
  }

  listRooms(): Promise<Room[]> {
    return Promise.resolve(Array.from(this.rooms.values()).map((room) => ({ ...room })));
  }

  getRoomById(roomId: string): Promise<Room | null> {
    const room = this.rooms.get(roomId);
    return Promise.resolve(room ? { ...room } : null);
  }

  createMember(member: RoomMember): Promise<RoomMember> {
    const roomMembers = this.members.get(member.roomId) ?? new Map<string, RoomMember>();
    roomMembers.set(member.userId, { ...member });
    this.members.set(member.roomId, roomMembers);
    return Promise.resolve({ ...member });
  }

  joinMember(member: RoomMember): Promise<RoomMember> {
    const roomMembers = this.members.get(member.roomId) ?? new Map<string, RoomMember>();
    roomMembers.set(member.userId, { ...member });
    this.members.set(member.roomId, roomMembers);
    return Promise.resolve({ ...member });
  }

  getMember(roomId: string, userId: string): Promise<RoomMember | null> {
    const member = this.members.get(roomId)?.get(userId);
    return Promise.resolve(member ? { ...member } : null);
  }

  updateMember(member: RoomMember): Promise<RoomMember | null> {
    const roomMembers = this.members.get(member.roomId);

    if (!roomMembers?.has(member.userId)) {
      return Promise.resolve(null);
    }

    roomMembers.set(member.userId, { ...member });
    return Promise.resolve({ ...member });
  }

  updateMemberRole(
    roomId: string,
    userId: string,
    role: RoomMember['role'],
  ): Promise<RoomMember | null> {
    const member = this.members.get(roomId)?.get(userId);

    if (!member) {
      return Promise.resolve(null);
    }

    const updated = { ...member, role };
    this.members.get(roomId)?.set(userId, updated);
    return Promise.resolve({ ...updated });
  }

  removeMember(roomId: string, userId: string): Promise<void> {
    this.members.get(roomId)?.delete(userId);
    const room = this.rooms.get(roomId);

    if (room) {
      this.rooms.set(roomId, {
        ...room,
        activeWatcherCount: Math.max(0, room.activeWatcherCount - 1),
      });
    }

    return Promise.resolve();
  }

  getMembersByRoomId(roomId: string): Promise<RoomMember[]> {
    return Promise.resolve(
      Array.from(this.members.get(roomId)?.values() ?? []).map((member) => ({
        ...member,
      })),
    );
  }

  listDueScheduledReminderRooms(nowIso: string): Promise<Room[]> {
    return Promise.resolve(
      Array.from(this.rooms.values()).filter(
        (room) =>
          room.isScheduled === true &&
          Boolean(room.reminderAt) &&
          room.reminderAt! <= nowIso &&
          !room.reminderSentAt &&
          room.reminderStatus !== 'sent',
      ),
    );
  }

  claimScheduledReminder(
    roomId: string,
    nowIso: string,
    staleBeforeIso: string,
  ): Promise<Room> {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new Error('Room not found');
    }

    if (
      room.reminderSentAt ||
      (room.reminderStatus === 'sending' &&
        room.reminderClaimedAt &&
        room.reminderClaimedAt >= staleBeforeIso)
    ) {
      throw new ReminderClaimConflictError(roomId);
    }

    const updated = {
      ...room,
      reminderStatus: 'sending' as const,
      reminderClaimedAt: nowIso,
    };
    this.rooms.set(roomId, updated);
    return Promise.resolve({ ...updated });
  }

  createInvite(invite: RoomInvite): Promise<RoomInvite> {
    return Promise.resolve({ ...invite });
  }

  getInviteByCode(): Promise<RoomInvite | null> {
    return Promise.resolve(null);
  }
}

class FakePresenceService {
  onlineUserIds: Set<string> | null = null;

  countOnlineByRoom(): Promise<number | null> {
    return Promise.resolve(this.onlineUserIds?.size ?? null);
  }

  listOnlineUserIdsByRoom(): Promise<Set<string> | null> {
    return Promise.resolve(this.onlineUserIds);
  }

  broadcastToRoom(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeScheduledPartyEmailService {
  readonly sent: SendScheduledPartyReminderEmailParams[] = [];

  sendScheduledPartyReminderEmail(
    params: SendScheduledPartyReminderEmailParams,
  ): Promise<void> {
    this.sent.push(params);
    return Promise.resolve();
  }
}

let repository: FakeRoomsRepository;
let presence: FakePresenceService;
let service: RoomsService;

beforeEach(() => {
  repository = new FakeRoomsRepository();
  presence = new FakePresenceService();
  service = new RoomsService(
    repository,
    presence as unknown as RealtimePresenceService,
  );

  repository.rooms.set('room-1', {
    roomId: 'room-1',
    title: 'Test room',
    isPrivate: false,
    visibilityStatus: 'public',
    hostUserId: 'host',
    coHostUserId: null,
    activeWatcherCount: 3,
    status: 'active',
    createdAt: '2026-05-14T00:00:00.000Z',
  });
  repository.members.set(
    'room-1',
    new Map<string, RoomMember>([
      [
        'host',
        {
          roomId: 'room-1',
          userId: 'host',
          role: 'host',
          joinedAt: '2026-05-14T00:00:00.000Z',
        },
      ],
      [
        'viewer-1',
        {
          roomId: 'room-1',
          userId: 'viewer-1',
          role: 'viewer',
          joinedAt: '2026-05-14T00:01:00.000Z',
        },
      ],
      [
        'viewer-2',
        {
          roomId: 'room-1',
          userId: 'viewer-2',
          role: 'viewer',
          joinedAt: '2026-05-14T00:02:00.000Z',
        },
      ],
    ]),
  );
});

test('host can set a co-host', async () => {
  const room = await service.setCoHost('room-1', 'host', 'viewer-1');

  assert.equal(room.coHostUserId, 'viewer-1');
  assert.equal(
    repository.members.get('room-1')?.get('viewer-1')?.role,
    'co-host',
  );
});

test('non-host cannot set a co-host', async () => {
  await assert.rejects(
    () => service.setCoHost('room-1', 'viewer-1', 'viewer-2'),
    ForbiddenException,
  );
});

test('co-host can be treated as a playback controller', async () => {
  await service.setCoHost('room-1', 'host', 'viewer-1');

  assert.equal(await service.isRoomController('room-1', 'viewer-1'), true);
});

test('viewer is not a playback controller', async () => {
  await service.setCoHost('room-1', 'host', 'viewer-1');

  assert.equal(await service.isRoomController('room-1', 'viewer-2'), false);
});

test('co-host leaving assigns a new online co-host when host is offline', async () => {
  await service.setCoHost('room-1', 'host', 'viewer-1');
  presence.onlineUserIds = new Set(['viewer-2']);

  await service.leaveRoom('room-1', 'viewer-1');

  assert.equal(repository.rooms.get('room-1')?.coHostUserId, 'viewer-2');
  assert.equal(
    repository.members.get('room-1')?.get('viewer-2')?.role,
    'co-host',
  );
});

test('last member leaving clears the co-host selection', async () => {
  repository.members.set(
    'room-1',
    new Map<string, RoomMember>([
      [
        'viewer-1',
        {
          roomId: 'room-1',
          userId: 'viewer-1',
          role: 'co-host',
          joinedAt: '2026-05-14T00:01:00.000Z',
        },
      ],
    ]),
  );
  repository.rooms.set('room-1', {
    ...repository.rooms.get('room-1')!,
    hostUserId: 'host',
    coHostUserId: 'viewer-1',
    activeWatcherCount: 1,
  });
  presence.onlineUserIds = new Set<string>();

  await service.leaveRoom('room-1', 'viewer-1');

  assert.equal(repository.rooms.get('room-1')?.coHostUserId, null);
});

test('host can create a scheduled party', async () => {
  const scheduledStartAt = futureIso(90);

  const response = await service.createScheduledRoom(
    {
      sub: 'host-2',
      email: 'host@example.com',
      preferred_username: 'Host Two',
    },
    {
      title: 'Movie night',
      description: 'Bring popcorn',
      videoUrl: 'https://example.com/movie',
      scheduledStartAt,
      reminderMinutesBefore: 30,
      visibility: 'private',
    },
  );

  const room = repository.rooms.get(response.roomId);
  const hostMember = repository.members.get(response.roomId)?.get('host-2');

  assert.equal(response.isScheduled, true);
  assert.equal(response.reminderStatus, 'pending');
  assert.equal(response.inviteUrl, room?.appRoomUrl);
  assert.equal(room?.scheduledStartAt, scheduledStartAt);
  assert.equal(hostMember?.role, 'host');
  assert.equal(hostMember?.rsvpStatus, 'going');
  assert.equal(hostMember?.email, 'host@example.com');
});

test('scheduledStartAt in the past fails', async () => {
  await assert.rejects(
    () =>
      service.createScheduledRoom(
        {
          sub: 'host-2',
          email: 'host@example.com',
        },
        {
          title: 'Too late',
          scheduledStartAt: '2020-01-01T00:00:00.000Z',
          reminderMinutesBefore: 30,
        },
      ),
    BadRequestException,
  );
});

test('user can RSVP going when email is available', async () => {
  repository.rooms.set('scheduled-1', {
    roomId: 'scheduled-1',
    title: 'Scheduled room',
    isPrivate: false,
    visibilityStatus: 'public',
    hostUserId: 'host',
    coHostUserId: null,
    activeWatcherCount: 1,
    isScheduled: true,
    scheduledStartAt: futureIso(120),
    reminderAt: futureIso(90),
    reminderMinutesBefore: 30,
    reminderStatus: 'pending',
    status: 'active',
    createdAt: '2026-05-14T00:00:00.000Z',
  });

  const response = await service.setRsvp(
    'scheduled-1',
    {
      sub: 'viewer-3',
      email: 'viewer@example.com',
      preferred_username: 'Viewer Three',
    },
    'going',
  );

  assert.equal(response.member.rsvpStatus, 'going');
  assert.equal(response.member.userId, 'viewer-3');
  assert.equal(
    repository.members.get('scheduled-1')?.get('viewer-3')?.email,
    'viewer@example.com',
  );
});

test('RSVP going requires an email address', async () => {
  repository.rooms.set('scheduled-1', {
    roomId: 'scheduled-1',
    title: 'Scheduled room',
    isPrivate: false,
    visibilityStatus: 'public',
    hostUserId: 'host',
    coHostUserId: null,
    activeWatcherCount: 1,
    isScheduled: true,
    scheduledStartAt: futureIso(120),
    reminderAt: futureIso(90),
    reminderMinutesBefore: 30,
    reminderStatus: 'pending',
    status: 'active',
    createdAt: '2026-05-14T00:00:00.000Z',
  });

  await assert.rejects(
    () =>
      service.setRsvp(
        'scheduled-1',
        {
          sub: 'viewer-3',
          preferred_username: 'Viewer Three',
        },
        'going',
      ),
    BadRequestException,
  );
});

test('reminder worker sends only RSVP going members and marks room sent', async () => {
  const now = new Date().toISOString();
  repository.rooms.set('scheduled-2', {
    roomId: 'scheduled-2',
    title: 'Worker room',
    isPrivate: false,
    visibilityStatus: 'public',
    hostUserId: 'host',
    coHostUserId: null,
    activeWatcherCount: 3,
    isScheduled: true,
    scheduledStartAt: futureIso(30),
    reminderAt: '2026-05-14T00:00:00.000Z',
    reminderMinutesBefore: 30,
    reminderStatus: 'pending',
    status: 'active',
    createdAt: now,
  });
  repository.members.set(
    'scheduled-2',
    new Map<string, RoomMember>([
      [
        'going',
        {
          roomId: 'scheduled-2',
          userId: 'going',
          role: 'viewer',
          joinedAt: now,
          email: 'going@example.com',
          rsvpStatus: 'going',
        },
      ],
      [
        'maybe',
        {
          roomId: 'scheduled-2',
          userId: 'maybe',
          role: 'viewer',
          joinedAt: now,
          email: 'maybe@example.com',
          rsvpStatus: 'maybe',
        },
      ],
      [
        'not-going',
        {
          roomId: 'scheduled-2',
          userId: 'not-going',
          role: 'viewer',
          joinedAt: now,
          email: 'notgoing@example.com',
          rsvpStatus: 'not_going',
        },
      ],
    ]),
  );
  const emailService = new FakeScheduledPartyEmailService();
  const worker = new ScheduledPartyReminderWorker(
    repository,
    emailService as unknown as ScheduledPartyEmailService,
    { get: () => undefined } as never,
  );

  await worker.runOnce();

  assert.deepEqual(
    emailService.sent.map((email) => email.to),
    ['going@example.com'],
  );
  assert.equal(repository.rooms.get('scheduled-2')?.reminderStatus, 'sent');
  assert.ok(repository.rooms.get('scheduled-2')?.reminderSentAt);
  assert.equal(
    repository.members.get('scheduled-2')?.get('going')?.reminderEmailStatus,
    'sent',
  );
  assert.equal(
    repository.members.get('scheduled-2')?.get('maybe')?.reminderEmailStatus,
    undefined,
  );
});

test('reminder worker is idempotent on repeated runs', async () => {
  const now = new Date().toISOString();
  repository.rooms.set('scheduled-3', {
    roomId: 'scheduled-3',
    title: 'Idempotent room',
    isPrivate: false,
    visibilityStatus: 'public',
    hostUserId: 'host',
    coHostUserId: null,
    activeWatcherCount: 1,
    isScheduled: true,
    scheduledStartAt: futureIso(30),
    reminderAt: '2026-05-14T00:00:00.000Z',
    reminderMinutesBefore: 30,
    reminderStatus: 'pending',
    status: 'active',
    createdAt: now,
  });
  repository.members.set(
    'scheduled-3',
    new Map<string, RoomMember>([
      [
        'going',
        {
          roomId: 'scheduled-3',
          userId: 'going',
          role: 'viewer',
          joinedAt: now,
          email: 'going@example.com',
          rsvpStatus: 'going',
        },
      ],
    ]),
  );
  const emailService = new FakeScheduledPartyEmailService();
  const worker = new ScheduledPartyReminderWorker(
    repository,
    emailService as unknown as ScheduledPartyEmailService,
    { get: () => undefined } as never,
  );

  await worker.runOnce();
  await worker.runOnce();

  assert.equal(emailService.sent.length, 1);
});

test('SES email service logs in dev mode when sender is not configured', async () => {
  const emailService = new ScheduledPartyEmailService({
    get: (key: string) => {
      if (key === 'NODE_ENV') {
        return 'development';
      }

      if (key === 'AWS_REGION') {
        return 'eu-central-1';
      }

      return undefined;
    },
  } as never);

  await emailService.sendScheduledPartyReminderEmail({
    to: 'viewer@example.com',
    displayName: 'Viewer',
    partyTitle: 'Movie night',
    scheduledStartAt: futureIso(60),
    roomUrl: 'http://localhost:3000/room/abc123',
  });
});

function futureIso(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}
