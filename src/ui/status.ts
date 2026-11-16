import { el } from "../utils/dom";

export function showStatus(message: string, warning = false) {
  const status = el("footer-status");
  status.textContent = message;
  status.title = message;
  status.dataset.kind = warning ? "warning" : "status";
}
