import { localDateValue } from "../utils/time";

export const dateValue = (date = new Date()) =>
  localDateValue(date).slice(0, 10);

export function currentWeekStart(now = new Date()): string {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dateValue(monday);
}

export function localDayRange(value: string): { from: number; to: number } {
  const from = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(from.getTime()) || dateValue(from) !== value)
    throw new Error("Choose a valid date");
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.getTime(), to: to.getTime() };
}
