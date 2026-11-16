import { readPreference, writePreference } from "../utils/preferences";
import { sources, type Source } from "./model";

export interface TimelinePreferences {
  sources: Source[];
  details: boolean;
  openDays: Record<string, boolean>;
}
const key = "quiet-time.timeline";
export function loadTimelinePreferences(): TimelinePreferences {
  const value = readPreference<Partial<TimelinePreferences> | null>(key, null);
  const openDays: Record<string, boolean> = {};
  if (value?.openDays && typeof value.openDays === "object")
    for (const [day, open] of Object.entries(value.openDays).slice(-70))
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && typeof open === "boolean")
        openDays[day] = open;
  return {
    sources: Array.isArray(value?.sources)
      ? sources.filter((source) => value.sources!.includes(source))
      : [...sources],
    details: value?.details === true,
    openDays,
  };
}
export function saveTimelinePreferences(value: TimelinePreferences) {
  value.openDays = Object.fromEntries(
    Object.entries(value.openDays).slice(-70),
  );
  writePreference(key, value);
}
