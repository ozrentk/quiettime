import { isValidMinutes } from "../utils/time";

export interface EntryDefaults {
  project: string;
  note: string;
  minutes: number;
}

const STORAGE_KEY = "quiet-time.defaults";

export function readDefaults(storage?: Storage): EntryDefaults {
  const defaults: EntryDefaults = { project: "", note: "", minutes: 15 };
  try {
    const saved = JSON.parse(
      (storage ?? localStorage).getItem(STORAGE_KEY) ?? "null",
    );
    if (!saved || typeof saved !== "object") return defaults;
    if (typeof saved.project === "string")
      defaults.project = saved.project.slice(0, 120);
    if (typeof saved.note === "string")
      defaults.note = saved.note.slice(0, 1000);
    if (typeof saved.minutes === "number" && isValidMinutes(saved.minutes))
      defaults.minutes = saved.minutes;
  } catch {
    // Invalid or unavailable saved preferences must not prevent startup.
  }
  return defaults;
}

export function writeDefaults(
  defaults: EntryDefaults,
  storage: Storage = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(defaults));
}
