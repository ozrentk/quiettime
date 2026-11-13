import { readDefaults, writeDefaults } from "../storage/defaults";
import { input } from "../utils/dom";
import { invoke } from "@tauri-apps/api/core";
import type { UIContext } from "./context";
import type { DefaultValuesController } from "./default-values";
import { isValidMinutes } from "../utils/time";
import { showStatus } from "./status";

export interface QuickNoteController {
  getValue(): string;
}

export function initQuickNote(
  context: UIContext,
  defaults: DefaultValuesController,
  showError: (message: unknown) => void,
): QuickNoteController {
  const field = input("note");
  field.value = readDefaults().note;
  function saveDraft() {
    try {
      writeDefaults({ ...readDefaults(), note: field.value });
    } catch {
      showError("Quick note could not be saved on this computer.");
    }
  }
  field.addEventListener("input", saveDraft);
  field.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || context.isBusy()) return;
    void context.run(async () => {
      if (!context.native)
        throw new Error("Open the Windows app to save entries.");
      const { project, minutes } = defaults.getValues();
      const note = field.value.trim();
      if (!project.trim())
        throw new Error("Select or enter a project/task first.");
      if (!isValidMinutes(minutes))
        throw new Error("Enter a whole number of minutes from 1 to 480.");
      if (!note) throw new Error("Enter a quick note first.");
      field.disabled = true;
      try {
        await invoke("add_entry", {
          project: project.trim(),
          note,
          minutes,
          end: Date.now(),
        });
        field.value = "";
        saveDraft();
        showStatus("Entry saved.");
        await context.refresh();
      } finally {
        field.disabled = false;
        field.focus();
      }
    });
  });
  return { getValue: () => field.value };
}
