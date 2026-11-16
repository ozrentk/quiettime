import { el, input } from "../utils/dom";
import { readPreference, writePreference } from "../utils/preferences";
import { showStatus } from "./status";

export interface PreviewSettings {
  manual: number;
  git: number;
  activity: number;
}
const key = "quiet-time.previews";
const defaults: PreviewSettings = { manual: 3, git: 10, activity: 10 };
const fields = ["manual", "git", "activity"] as const;
const saved = readPreference<Partial<PreviewSettings> | null>(key, null);
let current = { ...defaults };
for (const field of fields) {
  const value = saved?.[field];
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 100
  )
    current[field] = value;
}
export const getPreviewSettings = (): Readonly<PreviewSettings> => current;

export function initPreviewSettings(changed: () => void) {
  for (const field of fields)
    input(`preview-${field}`).value = String(current[field]);
  el<HTMLFormElement>("preview-settings-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const form = el<HTMLFormElement>("preview-settings-form");
      if (!form.reportValidity()) return;
      const next = { ...current };
      for (const field of fields) {
        const value = Number(input(`preview-${field}`).value);
        if (!Number.isInteger(value) || value < 1 || value > 100) return;
        next[field] = value;
      }
      current = next;
      writePreference(key, current);
      changed();
      showStatus("Recent item counts saved.");
    },
  );
}
