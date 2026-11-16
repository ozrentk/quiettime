import { invoke } from "@tauri-apps/api/core";
import { el, textNode } from "../utils/dom";
import { formatTime as time, formatDuration as duration } from "../utils/time";
import type { UIContext } from "./context";
import { getPreviewSettings } from "./preview-settings";
import { initActivity } from "./activity";

export function initRecords(context: UIContext) {
  const activity = initActivity();
  function renderEntries() {
    const data = context.getData();
    const list = el("recent-entries");
    list.replaceChildren();
    const rows = (data?.recentEntries ?? data?.entries ?? []).slice(
      0,
      getPreviewSettings().manual,
    );
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
          `${new Date(row.start).toLocaleDateString([], { month: "short", day: "numeric" })} · ${time(row.start)} – ${time(row.end)}`,
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

  function render() {
    renderEntries();
    activity.render(
      context.getData()?.activity ?? [],
      context.getData()?.paused ?? true,
      getPreviewSettings().activity,
    );
  }
  render();
  return { render };
}
