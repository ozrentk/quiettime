export function isValidMinutes(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 480;
}

export function formatTime(milliseconds: number): string {
  return new Date(milliseconds).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes === 0) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}

export function localDateValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
