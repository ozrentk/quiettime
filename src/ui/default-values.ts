import { invoke } from "@tauri-apps/api/core";
import {
  readDefaults,
  writeDefaults,
  type EntryDefaults,
} from "../storage/defaults";
import { el, input } from "../utils/dom";
import { formatTime, isValidMinutes } from "../utils/time";
import type { UIContext } from "./context";

export interface DefaultValuesController {
  getValues(): EntryDefaults;
  save(): void;
  updateDuration(): void;
}

export function initDefaultValues(
  context: UIContext,
  showError: (message: unknown) => void,
): DefaultValuesController {
  const saved = readDefaults();
  let minutes = saved.minutes;
  input("project").value = saved.project;
  input("note").value = saved.note;
  input("minutes").value = String(minutes);

  function getValues(): EntryDefaults {
    return {
      project: input("project").value,
      note: input("note").value,
      minutes,
    };
  }

  function save() {
    try {
      writeDefaults({
        ...getValues(),
        minutes: isValidMinutes(minutes) ? minutes : 15,
      });
    } catch {
      showError("Default values could not be saved on this computer.");
    }
  }

  function updateDuration() {
    el("save").textContent = isValidMinutes(minutes)
      ? `Log ${minutes} minutes`
      : "Log time";
    const end = Date.now();
    el("range-hint").textContent = isValidMinutes(minutes)
      ? `Last ${minutes} min · ${formatTime(end - minutes * 60000)} – ${formatTime(end)}`
      : "";
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "#entry-form [data-minutes]",
    )) {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.minutes) === minutes),
      );
    }
  }

  function setMinutes(value: number) {
    minutes = value;
    input("minutes").value = Number.isFinite(value) ? String(value) : "";
    save();
    updateDuration();
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "#entry-form [data-minutes]",
  )) {
    button.addEventListener("click", () =>
      setMinutes(Number(button.dataset.minutes)),
    );
  }
  input("minutes").addEventListener("input", () =>
    setMinutes(input("minutes").valueAsNumber),
  );
  for (const id of ["project", "note"])
    input(id).addEventListener("input", save);
  el("entry-form").addEventListener("submit", (event) =>
    event.preventDefault(),
  );
  el("save").addEventListener("click", (event) => {
    event.preventDefault();
    if (!el<HTMLFormElement>("entry-form").reportValidity()) return;
    void context.run(async () => {
      if (!context.native)
        throw new Error("Open the Windows app to save entries.");
      if (!isValidMinutes(minutes))
        throw new Error("Enter a whole number of minutes from 1 to 480.");
      await invoke("add_entry", {
        ...getValues(),
        end: Math.floor(Date.now() / 60000) * 60000,
      });
      el("saved").textContent = "Saved locally";
      updateDuration();
      await context.refresh();
      input("project").focus();
      window.setTimeout(() => {
        el("saved").textContent = "";
      }, 3500);
    });
  });
  el<HTMLButtonElement>("save").disabled = !context.native;
  updateDuration();
  return { getValues, save, updateDuration };
}
