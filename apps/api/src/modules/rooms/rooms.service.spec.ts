import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';

import type { RealtimePresenceService } from '../realtime/realtime-presence.service';
import type { Room } from './entities/room.entity';
import type { RoomInvite } from './entities/room-invite.entity';
import type { RoomMember } from './entities/room-member.entity';
import type { RoomsRepository } from './repositories/rooms.repository';
import { RoomsService } from './rooms.service';

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
