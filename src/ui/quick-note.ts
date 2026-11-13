import { readDefaults, writeDefaults } from "../storage/defaults";
import { input } from "../utils/dom";

export interface QuickNoteController {
  getValue(): string;
}

export function initQuickNote(
  showError: (message: unknown) => void,
): QuickNoteController {
  const field = input("note");
  field.value = readDefaults().note;
  field.addEventListener("input", () => {
    try {
      writeDefaults({ ...readDefaults(), note: field.value });
    } catch {
      showError("Quick note could not be saved on this computer.");
    }
  });
  return { getValue: () => field.value };
}
