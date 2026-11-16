import { readDefaults, writeDefaults } from "../storage/defaults";
import { input } from "../utils/dom";
import { invoke } from "@tauri-apps/api/core";
import type { UIContext } from "./context";
import type { DefaultValuesController } from "./default-values";
import { isValidMinutes } from "../utils/time";
import type { SavedEntry } from "../types";
import { showEntrySaved } from "./entry-feedback";
import { clearFieldError, FieldValidationError } from "./field-errors";

export interface QuickNoteController {
  getValue(): string;
}

export function initQuickNote(
  context: UIContext,
  defaults: DefaultValuesController,
  showError: (message: unknown) => void,
): QuickNoteController {
  const field = input("note");
  let submitting = false;
  field.value = readDefaults().note;
  function saveDraft() {
    try {
      writeDefaults({ ...readDefaults(), note: field.value });
    } catch {
      showError("Quick note could not be saved on this computer.");
    }
  }
  field.addEventListener("input", () => {
    if (field.value.trim()) clearFieldError("note");
    saveDraft();
  });
  field.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || submitting) return;
    submitting = true;
    field.disabled = true;
    const note = field.value.trim();
    const end = Date.now();
    void context
      .run(
        async () => {
          if (!context.native)
            throw new Error("Open the Windows app to save entries.");
          const { project, minutes } = defaults.getValues();
          if (!project.trim())
            throw new FieldValidationError(
              "project",
              "Select or enter a project/task first.",
            );
          if (!isValidMinutes(minutes))
            throw new FieldValidationError(
              "minutes",
              "Enter a whole number of minutes from 1 to 480.",
            );
          if (!note)
            throw new FieldValidationError("note", "Enter a quick note first.");
          const saved = await invoke<SavedEntry>("add_entry", {
            project: project.trim(),
            note,
            minutes,
            end,
          });
          field.value = "";
          saveDraft();
          showEntrySaved(saved);
          await context.refresh();
        },
        { queue: true },
      )
      .finally(() => {
        submitting = false;
        field.disabled = false;
        if (!field.closest<HTMLElement>("[role=tabpanel]")?.hidden)
          field.focus();
      });
  });
  return { getValue: () => field.value };
}
