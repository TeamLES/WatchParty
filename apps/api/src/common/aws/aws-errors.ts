export function getErrorName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('name' in error)) {
    return undefined;
  }

  const value = (error as { name: unknown }).name;
  return typeof value === 'string' ? value : undefined;
}
