import { invoke } from "@tauri-apps/api/core";
import type { TimingSettings } from "../types";
import { el, input } from "../utils/dom";
import type { UIContext } from "./context";
import { showStatus } from "./status";

export function initTimingSettings(context: UIContext) {
  const fields = {
    activitySeconds: "activity-seconds",
    idleSeconds: "idle-seconds",
    gitSeconds: "git-seconds",
    refreshSeconds: "refresh-seconds",
  } as const;
  const form = el<HTMLFormElement>("timing-form");
  let dirty = false;
  let pending = false;
  function controls() {
    for (const id of Object.values(fields))
      input(id).disabled = pending || !context.native;
    el<HTMLButtonElement>("timing-save").disabled =
      pending || context.isBusy() || !context.native;
  }
  form.addEventListener("input", () => {
    dirty = true;
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!context.native || context.isBusy()) return;
    if (!form.reportValidity()) return;
    const timings = Object.fromEntries(
      Object.entries(fields).map(([key, id]) => [key, input(id).valueAsNumber]),
    ) as unknown as TimingSettings;
    void context.run(async () => {
      pending = true;
      controls();
      try {
        await invoke("set_timing", { timings });
        dirty = false;
        await context.refresh();
        showStatus("Timing settings saved.");
      } finally {
        pending = false;
      }
    });
  });
  if (!context.native)
    for (const field of form.querySelectorAll<
      HTMLInputElement | HTMLButtonElement
    >("input, button"))
      field.disabled = true;
  return {
    render(timings: TimingSettings) {
      if (!dirty)
        for (const [key, id] of Object.entries(fields))
          input(id).value = String(timings[key as keyof TimingSettings]);
      controls();
    },
  };
}
