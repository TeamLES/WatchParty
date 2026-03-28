export const ROOMS_REPOSITORY = Symbol('ROOMS_REPOSITORY');

export type RoomsRepositoryDriver = 'inmemory' | 'dynamodb';

export function normalizeRoomsRepositoryDriver(
  value: string | undefined,
): RoomsRepositoryDriver {
  if (value?.toLowerCase() === 'dynamodb') {
    return 'dynamodb';
  }

  return 'inmemory';
}
