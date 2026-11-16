import type { SavedEntry } from "../types";
import { showStatus } from "./status";

export function showEntrySaved(result: SavedEntry, label = "Entry saved.") {
  showStatus(
    result.overlaps ? `${label} Warning: overlaps existing time.` : label,
    result.overlaps,
  );
}
