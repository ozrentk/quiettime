import { dateValue, localDayRange } from "../git/dates";

export function weekDays(
  anchor: string,
): { key: string; from: number; to: number }[] {
  const monday = new Date(localDayRange(anchor).from);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    const key = dateValue(date);
    return { key, ...localDayRange(key) };
  });
}

export function shiftWeek(anchor: string, direction: number): string {
  const date = new Date(localDayRange(anchor).from);
  date.setDate(date.getDate() + direction * 7);
  return dateValue(date);
}
