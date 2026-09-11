export function validQueueIndex(length: number, index: number): number {
  return Math.max(0, Math.min(length - 1, Number.isFinite(index) ? Math.trunc(index) : 0));
}

export function nextQueueIndex(length: number, current: number, shuffle: boolean, repeat: 'off' | 'all' | 'one'): number | null {
  if (length === 0) return null;
  if (length === 1) return repeat === 'off' ? null : 0;
  // Uniformly choose another entry without an unbounded random loop.
  if (shuffle) return (current + 1 + Math.floor(Math.random() * (length - 1))) % length;
  if (current + 1 < length) return current + 1;
  return repeat === 'all' ? 0 : null;
}
