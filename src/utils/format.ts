/** Formats whole seconds as "M:SS", the standard transport-readout format. */
export function formatDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Formats whole seconds as "H HR M MIN" / "M MIN" for playlist and album totals. */
export function formatLongDuration(totalSeconds: number): string {
  const totalMinutes = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds / 60)) : 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} MIN`;
  if (minutes === 0) return `${hours} HR`;
  return `${hours} HR ${minutes} MIN`;
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Late Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}
