import { invoke } from "@tauri-apps/api/core";
import { el, input } from "../utils/dom";
import { formatTime, isValidMinutes, localDateValue } from "../utils/time";
import type { UIContext } from "./context";
import type { DefaultValuesController } from "./default-values";
import type { ProjectSelectionController } from "./project-selection";
import type { QuickNoteController } from "./quick-note";
import { showStatus } from "./status";

export interface ManualEntryController {
  isOpen(): boolean;
  focus(): void;
}

export function initManualEntry(
  context: UIContext,
  defaults: DefaultValuesController,
  projects: ProjectSelectionController,
  quickNote: QuickNoteController,
): ManualEntryController {
  const dialog = el<HTMLDialogElement>("manual-dialog");
  let minutes = 15;
  let anchor: "start" | "end" = "end";

  function updateDuration(value: number, synchronize = true) {
    minutes = value;
    input("manual-minutes").value = Number.isFinite(value) ? String(value) : "";
    if (synchronize && isValidMinutes(value)) {
      const timestamp = new Date(input("manual-" + anchor).value).getTime();
      if (Number.isFinite(timestamp))
        input(anchor === "end" ? "manual-start" : "manual-end").value =
          localDateValue(
            new Date(timestamp + (anchor === "end" ? -1 : 1) * value * 60000),
          );
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "#manual-form [data-minutes]",
    ))
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.minutes) === value),
      );
    const start = new Date(input("manual-start").value).getTime();
    const end = new Date(input("manual-end").value).getTime();
    el("manual-range").textContent =
      Number.isFinite(start) && Number.isFinite(end)
        ? `${formatTime(start)} – ${formatTime(end)}`
        : "";
  }

  const focus = () => input("manual-project").focus();
  function open() {
    if (context.isBusy() || dialog.open) return;
    projects.close();
    const values = defaults.getValues();
    input("manual-project").value = values.project;
    input("manual-note").value = quickNote.getValue();
    input("manual-end").value = localDateValue(new Date());
    anchor = "end";
    updateDuration(isValidMinutes(values.minutes) ? values.minutes : 15);
    el("manual-error").hidden = true;
    dialog.showModal();
    focus();
  }

  function close() {
    if (context.isBusy()) return;
    projects.close();
    dialog.close();
    el("manual-entry").focus();
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "#manual-form [data-minutes]",
  ))
    button.addEventListener("click", () =>
      updateDuration(Number(button.dataset.minutes)),
    );
  input("manual-minutes").addEventListener("input", () =>
    updateDuration(input("manual-minutes").valueAsNumber),
  );
  input("manual-start").addEventListener("input", () => {
    anchor = "start";
    updateDuration(minutes);
  });
  input("manual-end").addEventListener("input", () => {
    anchor = "end";
    const start = new Date(input("manual-start").value).getTime();
    const end = new Date(input("manual-end").value).getTime();
    updateDuration((end - start) / 60000, false);
  });
  el("manual-entry").addEventListener("click", open);
  for (const id of ["manual-close", "manual-cancel"])
    el(id).addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (projects.isOpen("manual-")) projects.close();
    else close();
  });
  el("manual-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void context.run(async () => {
      if (!context.native)
        throw new Error("Open the Windows app to save entries.");
      const start = new Date(input("manual-start").value).getTime();
      const end = new Date(input("manual-end").value).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        throw new Error(
          "Choose a start and end time, with the end after the start.",
        );
      if (!isValidMinutes(minutes))
        throw new Error("Enter a whole number of minutes from 1 to 480.");
      await invoke("add_manual_entry", {
        project: input("manual-project").value,
        note: input("manual-note").value,
        start,
        end,
      });
      dialog.close();
      projects.close();
      el("manual-entry").focus();
      showStatus("Manual entry saved.");
      await context.refresh();
    });
  });
  el<HTMLButtonElement>("manual-save").disabled = !context.native;
  return { isOpen: () => dialog.open, focus };
}
