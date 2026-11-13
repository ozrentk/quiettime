import { invoke } from "@tauri-apps/api/core";
import type { Dashboard } from "../types";
import { el, input } from "../utils/dom";
import type { UIContext } from "./context";
import { initTimingSettings } from "./timing-settings";

export function initSettings(context: UIContext) {
  const timing = initTimingSettings(context);
  function render(data: Dashboard) {
    timing.render(data.timings);
    el("status").textContent = data.paused
      ? "Tracking paused"
      : data.captureError
        ? "Capture needs attention"
        : "Capturing activity";
    el("status-dot").className =
      data.paused || data.captureError ? "paused" : "";
    el<HTMLButtonElement>("pause").disabled = false;
    el("pause").textContent = data.paused ? "Start tracking" : "Pause";
    input("titles").checked = data.captureTitles;
    input("startup").checked = data.startupEnabled;
    input("startup").disabled = context.isBusy() || !data.startupAvailable;
    el("startup-help").textContent = data.startupAvailable
      ? "The HUD stays hidden at sign-in. Use your shortcut or the tray icon to open it."
      : "Open the standalone app with npm run desktop to configure Windows startup.";
    if (document.activeElement !== input("shortcut"))
      input("shortcut").value = data.shortcut;
    el("shortcut-hint").textContent = data.shortcut;
    el("database-path").textContent = data.databasePath;
    el("activity-help").textContent =
      `Apps are sampled every ${data.timings.activitySeconds} seconds. After ${data.timings.idleSeconds} seconds without input, time is marked idle. Sleep gaps and time in this panel are skipped. Window titles may contain document or website names; disabling titles affects future records.`;
  }

  el("pause").addEventListener(
    "click",
    () =>
      void context.run(async () => {
        await invoke("set_paused", { paused: !context.getData()?.paused });
        await context.refresh();
      }),
  );
  input("titles").addEventListener(
    "change",
    () =>
      void context.run(async () => {
        await invoke("set_capture_titles", {
          enabled: input("titles").checked,
        });
        await context.refresh();
      }),
  );
  input("startup").addEventListener("change", () => {
    const enabled = input("startup").checked;
    input("startup").disabled = true;
    void context
      .run(async () => {
        await invoke("set_startup", { enabled });
        await context.refresh();
      })
      .finally(() => {
        input("startup").checked = context.getData()?.startupEnabled ?? false;
        input("startup").disabled = !context.getData()?.startupAvailable;
      });
  });
  el("shortcut-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void context.run(async () => {
      await invoke("set_shortcut", {
        shortcut: input("shortcut").value.trim(),
      });
      await context.refresh();
    });
  });
  if (!context.native) {
    el("preview").hidden = false;
    el("status").textContent = "Desktop preview";
    el("status-dot").className = "paused";
    for (const id of ["pause", "titles", "shortcut"])
      (el(id) as HTMLInputElement | HTMLButtonElement).disabled = true;
  }
  return { render };
}
