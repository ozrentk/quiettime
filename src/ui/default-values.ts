import {
  readDefaults,
  writeDefaults,
  type EntryDefaults,
} from "../storage/defaults";
import { el, input } from "../utils/dom";
import { isValidMinutes } from "../utils/time";

export interface DefaultValuesController {
  getValues(): Pick<EntryDefaults, "project" | "minutes">;
  save(): void;
  updateDuration(): void;
}

export function initDefaultValues(
  showError: (message: unknown) => void,
): DefaultValuesController {
  const saved = readDefaults();
  let minutes = saved.minutes;
  input("project").value = saved.project;
  input("minutes").value = String(minutes);

  function getValues(): Pick<EntryDefaults, "project" | "minutes"> {
    return {
      project: input("project").value,
      minutes,
    };
  }

  function save() {
    try {
      writeDefaults({
        ...readDefaults(),
        ...getValues(),
        minutes: isValidMinutes(minutes) ? minutes : 15,
      });
    } catch {
      showError("Default values could not be saved on this computer.");
    }
  }

  function updateDuration() {
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
  input("project").addEventListener("input", save);
  el("entry-form").addEventListener("submit", (event) =>
    event.preventDefault(),
  );
  updateDuration();
  return { getValues, save, updateDuration };
}
