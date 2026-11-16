import { groupActivity } from "../activity/grouping";
import type { Activity } from "../types";
import { el, textNode } from "../utils/dom";
import { formatDuration, formatTime } from "../utils/time";

export function initActivity() {
  const openApps = new Map<string, boolean>();
  function render(rows: Activity[], paused: boolean, limit = 100) {
    const list = el("activity-records");
    // Preserve expansion across the five-second dashboard refresh.
    for (const group of list.querySelectorAll<HTMLDetailsElement>(
      "details[data-app]",
    ))
      openApps.set(group.dataset.app!, group.open);
    list.replaceChildren();
    const groups = groupActivity(rows);
    if (!groups.length) {
      list.append(
        textNode(
          "p",
          paused
            ? "Start tracking to record activity."
            : "No activity recorded yet.",
          "empty",
        ),
      );
      return;
    }
    for (const app of groups.slice(0, limit)) {
      const group = document.createElement("details");
      group.className = "activity-app";
      group.dataset.app = app.key;
      group.open = openApps.get(app.key) ?? false;
      const summary = document.createElement("summary");
      summary.append(
        textNode("strong", app.app, "activity-app-name"),
        textNode(
          "span",
          `${app.sessions.length} ${app.sessions.length === 1 ? "session" : "sessions"}`,
          "activity-session-count",
        ),
        textNode("span", formatDuration(app.duration), "record-duration"),
      );
      group.append(summary);
      for (const session of app.sessions) {
        const block = document.createElement("section");
        block.className = "activity-session";
        const heading = document.createElement("div");
        heading.className = "activity-session-heading";
        heading.append(
          textNode(
            "span",
            `${formatTime(session.start)} – ${formatTime(session.end)}`,
          ),
          textNode("span", formatDuration(session.duration)),
        );
        block.append(heading);
        const visibleTitles = session.titles.filter((title) => title.title);
        for (const title of visibleTitles) {
          if (!title.title) continue;
          const item = document.createElement("div");
          item.className = "record activity-title";
          const content = document.createElement("div");
          content.className = "record-content";
          const label = textNode("p", title.title, "activity-title-text");
          label.title = title.originals.join("\n");
          content.append(label);
          if (visibleTitles.length > 1)
            content.append(
              textNode(
                "small",
                `${formatTime(title.start)} – ${formatTime(title.end)}`,
                "record-time",
              ),
            );
          item.append(content);
          if (visibleTitles.length > 1)
            item.append(
              textNode(
                "span",
                formatDuration(title.duration),
                "record-duration",
              ),
            );
          block.append(item);
        }
        group.append(block);
      }
      list.append(group);
    }
  }
  return { render };
}
