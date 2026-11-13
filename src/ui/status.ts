import { el } from "../utils/dom";

export function showStatus(message: string) {
  const status = el("footer-status");
  status.textContent = message;
  status.title = message;
}
