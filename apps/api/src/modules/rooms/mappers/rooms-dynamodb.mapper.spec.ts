import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fromRoomItem, toRoomItem } from './rooms-dynamodb.mapper';
import type { Room } from '../entities/room.entity';

test('maps scheduled private rooms without a password', () => {
  const room: Room = {
    roomId: 'scheduled-private',
    title: 'Movie night',
    isPrivate: true,
    visibilityStatus: 'private',
    hostUserId: 'host',
    coHostUserId: null,
    activeWatcherCount: 0,
    isScheduled: true,
    scheduledStartAt: '2026-05-14T20:00:00.000Z',
    reminderMinutesBefore: 30,
    reminderAt: '2026-05-14T19:30:00.000Z',
    reminderStatus: 'pending',
    status: 'active',
    createdAt: '2026-05-14T12:00:00.000Z',
    updatedAt: '2026-05-14T12:00:00.000Z',
  };

  const item: Record<string, unknown> = { ...toRoomItem(room) };
  const mapped = fromRoomItem(item);

  assert.ok(mapped);
  assert.equal(mapped.roomId, room.roomId);
  assert.equal(mapped.isPrivate, true);
  assert.equal(mapped.isScheduled, true);
  assert.equal(mapped.password, undefined);
});

test('rejects non-scheduled private rooms without a password', () => {
  const room: Room = {
    roomId: 'broken-private',
    title: 'Private room',
    isPrivate: true,
    visibilityStatus: 'private',
    hostUserId: 'host',
    coHostUserId: null,
    activeWatcherCount: 0,
    status: 'active',
    createdAt: '2026-05-14T12:00:00.000Z',
    updatedAt: '2026-05-14T12:00:00.000Z',
  };

  const item: Record<string, unknown> = { ...toRoomItem(room) };

  assert.equal(fromRoomItem(item), null);
});
