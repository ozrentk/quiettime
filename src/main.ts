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
import { initQuickNote } from "./ui/quick-note";
import { initGit } from "./ui/git";
import { el, input } from "./utils/dom";
import { initAppearance } from "./ui/appearance";
import { initTabs } from "./ui/tabs";
import { initTooltips } from "./ui/tooltips";
import { mountProjectSelectors } from "./ui/project-selector";
import { initDashboardRefresh } from "./ui/dashboard-refresh";
import { renderCaptureHealth } from "./ui/capture-health";

mountProjectSelectors();
initAppearance();
initTooltips();
const native = isTauri();
let data: Dashboard | undefined;
let busy = false;

function showError(message: unknown = "") {
  const dialog = el<HTMLDialogElement>("manual-dialog");
  const target = el(
    dialog.open
      ? "manual-error"
      : el<HTMLDialogElement>("git-dialog").open
        ? "git-dialog-error"
        : "error",
  );
  target.textContent = String(message);
  target.hidden = !message;
}

async function run(work: () => Promise<void>) {
  if (busy) return;
  busy = true;
  el<HTMLButtonElement>("manual-save").disabled = true;
  showError();
  try {
    await work();
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    el<HTMLButtonElement>("manual-save").disabled = !native;
    input("startup").disabled = !data?.startupAvailable;
    if (data) settings.render(data);
  }
}

const context: UIContext = {
  native,
  isBusy: () => busy,
  getData: () => data,
  run,
  refresh,
};
const defaults = initDefaultValues(showError);
const quickNote = initQuickNote(context, defaults, showError);
const projects = initProjectSelection(context, defaults.save);
const manual = initManualEntry(context, defaults, projects, quickNote);
const settings = initSettings(context);
const git = initGit(context, projects);
const records = initRecords(context);
const autoRefresh = initDashboardRefresh(() => refresh().catch(showError));
const tabs = initTabs((section) => {
  projects.close();
  git.setActive(section === "git");
});

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
  git.update(data.projects);
  records.render(from.getTime(), to.getTime());
  renderCaptureHealth(data);
  autoRefresh.setSeconds(data.timings.refreshSeconds);
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
  if (event.key !== "Escape" || manual.isOpen() || git.isDialogOpen()) return;
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
  const hudOpened = listen("hud-opened", () => {
    defaults.updateDuration();
    if (manual.isOpen()) manual.focus();
    else if (git.isDialogOpen()) git.focusDialog();
    else tabs.focusActive();
    void refresh().catch(showError);
  });
  const trackingChanged = listen("tracking-changed", () => {
    void refresh().catch(showError);
  });
  const gitChanged = listen("git-changed", () => {
    void git.refresh();
  });
  const captureHealth = listen("capture-health-changed", () => {
    void refresh().catch(showError);
  });
  const timingChanged = listen("timing-changed", () => {
    void refresh().catch(showError);
  });
  autoRefresh.start();
  input("project").focus();
  // Reveal only after styles, controls and event subscriptions are initialized.
  // Do not wait for dashboard/Git queries or animation frames in a hidden WebView.
  void Promise.all([
    hudOpened,
    trackingChanged,
    gitChanged,
    captureHealth,
    timingChanged,
  ])
    .catch(showError)
    .then(() => invoke("hud_ready", { frontendMs: performance.now() }))
    .catch(showError);
}
