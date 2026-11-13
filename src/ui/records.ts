import { invoke } from "@tauri-apps/api/core";
import { el, textNode } from "../utils/dom";
import { formatTime as time, formatDuration as duration } from "../utils/time";
import type { UIContext } from "./context";
import { initActivity } from "./activity";

export function initRecords(context: UIContext) {
  const activity = initActivity();
  function renderEntries() {
    const data = context.getData();
    const list = el("entries-records");
    list.replaceChildren();
    const rows = data?.entries ?? [];
    if (!rows.length) {
      list.append(textNode("p", "Manual entries will appear here.", "empty"));
      return;
    }
    for (const row of rows) {
      const item = document.createElement("article");
      item.className = "record";
      const content = document.createElement("div");
      content.className = "record-content";
      content.append(textNode("strong", row.project));
      const subtitle = row.note;
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
      {
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
    renderEntries();
    activity.render(
      context.getData()?.activity ?? [],
      context.getData()?.paused ?? true,
    );
  }
  renderEntries();
  activity.render(
    context.getData()?.activity ?? [],
    context.getData()?.paused ?? true,
  );
  return { render: updateTotals };
}
