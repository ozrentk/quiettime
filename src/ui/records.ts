import { invoke } from "@tauri-apps/api/core";
import { el, textNode } from "../utils/dom";
import { formatTime as time, formatDuration as duration } from "../utils/time";
import type { UIContext } from "./context";
export function initRecords(context: UIContext) {
  function renderList(tab: "entries" | "activity") {
    const data = context.getData();
    const list = el(tab + "-records");
    list.replaceChildren();
    const rows =
      tab === "entries" ? (data?.entries ?? []) : (data?.activity ?? []);
    if (!rows.length) {
      list.append(
        textNode(
          "p",
          tab === "entries"
            ? "Manual entries will appear here."
            : data?.paused
              ? "Start tracking to record activity."
              : "No activity recorded yet.",
          "empty",
        ),
      );
      return;
    }
    for (const row of rows) {
      const item = document.createElement("article");
      item.className = "record";
      const content = document.createElement("div");
      content.className = "record-content";
      const entry = "project" in row;
      content.append(textNode("strong", entry ? row.project : row.app));
      const subtitle = entry
        ? row.note
        : row.kind === "idle"
          ? "No input for 60+ seconds"
          : row.title;
      if (subtitle) content.append(textNode("p", subtitle, "record-note"));
      content.append(
        textNode(
          "small",
          `${time(row.start)} – ${time(row.end)}`,
          "record-time",
        ),
      );
      item.append(
        content,
        textNode("span", duration(row.end - row.start), "record-duration"),
      );
      if (entry) {
        const remove = document.createElement("button");
        remove.className = "delete";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Delete ${row.project} entry`);
        remove.addEventListener(
          "click",
          () =>
            void context.run(async () => {
              await invoke("delete_entry", { id: row.id });
              await context.refresh();
            }),
        );
        item.append(remove);
      }
      list.append(item);
    }
  }

  function updateTotals(from: number, to: number) {
    const data = context.getData();
    if (data) {
      el("entry-count").textContent = String(data.entries.length);
      el("total").textContent =
        `${duration(data.entries.reduce((sum, entry) => sum + Math.max(0, Math.min(entry.end, to) - Math.max(entry.start, from)), 0))} logged`;
    }
    renderList("entries");
    renderList("activity");
  }
  renderList("entries");
  renderList("activity");
  return { render: updateTotals };
}
