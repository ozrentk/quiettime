import type { Dashboard } from "../types";
import { el } from "../utils/dom";

export function renderCaptureHealth(data: Dashboard) {
  const warning = el("health-warning");
  const messages: string[] = [];
  if (data.shortcutError)
    messages.push(
      `Shortcut unavailable: ${data.shortcutError}. Change it in Preferences or open from the tray.`,
    );
  if (!data.paused && data.captureError)
    messages.push(`Capture: ${data.captureError}`);
  warning.textContent = messages.join(" ");
  warning.hidden = messages.length === 0;
}
