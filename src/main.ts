import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Dashboard } from "./types";
import type { UIContext } from "./ui/context";
import { initDefaultValues } from "./ui/default-values";
import { initManualEntry } from "./ui/manual-entry";
import { initProjectSelection } from "./ui/project-selection";
import { initSettings } from "./ui/settings";
import { initRecords } from "./ui/records";
import { el, input } from "./utils/dom";

const native = isTauri();
let data: Dashboard | undefined;
let busy = false;

function showError(message: unknown = "") {
  const dialog = el<HTMLDialogElement>("manual-dialog");
  const target = el(dialog.open ? "manual-error" : "error");
  target.textContent = String(message);
  target.hidden = !message;
}

async function run(work: () => Promise<void>) {
  if (busy) return;
  busy = true;
  el<HTMLButtonElement>("save").disabled = true;
  el<HTMLButtonElement>("manual-save").disabled = true;
  showError();
  try {
    await work();
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    el<HTMLButtonElement>("save").disabled = !native;
    el<HTMLButtonElement>("manual-save").disabled = !native;
    input("startup").disabled = !data?.startupAvailable;
  }
}

const context: UIContext = {
  native,
  isBusy: () => busy,
  getData: () => data,
  run,
  refresh,
};
const defaults = initDefaultValues(context, showError);
const projects = initProjectSelection(context, defaults.save);
const manual = initManualEntry(context, defaults, projects);
const settings = initSettings(context);
const records = initRecords(context);

async function refresh() {
  if (!native) return;
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  data = await invoke<Dashboard>("dashboard", {
    from: from.getTime(),
    to: to.getTime(),
  });
  settings.render(data);
  projects.render(data.projects);
  records.render(from.getTime(), to.getTime());
  if (data.shortcutError)
    showError(
      `Shortcut unavailable: ${data.shortcutError}. You can change it below or open from the tray.`,
    );
  else if (data.captureError) showError(`Capture: ${data.captureError}`);
}

el("today").textContent = new Date().toLocaleDateString([], {
  weekday: "long",
  month: "short",
  day: "numeric",
});
const hide = () => {
  if (native) void invoke("hide_hud").catch(showError);
};
el("hide").addEventListener("click", hide);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || manual.isOpen()) return;
  if (projects.isOpen()) {
    projects.close();
    input("project").focus();
  } else hide();
});
el("titlebar").addEventListener("mousedown", (event) => {
  if (
    native &&
    event.button === 0 &&
    !(event.target as HTMLElement).closest("button")
  )
    void getCurrentWindow().startDragging().catch(showError);
});

if (native) {
  void refresh().catch(showError);
  void listen("hud-opened", () => {
    defaults.updateDuration();
    if (manual.isOpen()) manual.focus();
    else input("project").focus();
    void refresh().catch(showError);
  });
  void listen("tracking-changed", () => {
    void refresh().catch(showError);
  });
  window.setInterval(() => {
    if (!document.hidden) void refresh().catch(showError);
  }, 5000);
  input("project").focus();
}
