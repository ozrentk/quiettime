import { dateValue } from "../../git/dates";
import { sourceLabels, sources, type TimelineDay } from "../../timeline/model";
import type { TimelinePreferences } from "../../timeline/preferences";
import { el, textNode } from "../../utils/dom";
import { formatDuration, formatTime } from "../../utils/time";

export function renderTimeline(
  days: TimelineDay[],
  prefs: TimelinePreferences,
  toggled: (key: string, open: boolean) => void,
  remove: (id: number) => void,
  native: boolean,
) {
  const list = el("timeline-days");
  const focused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement.dataset.timelineDay
      : undefined;
  list.replaceChildren();
  const today = dateValue();
  for (const day of days) {
    const section = document.createElement("details");
    section.className = "timeline-day";
    section.dataset.day = day.key;
    section.open = prefs.openDays[day.key] ?? day.key === today;
    const summary = document.createElement("summary");
    summary.dataset.timelineDay = day.key;
    const heading = document.createElement("div");
    const date = new Date(day.from).toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    heading.append(
      textNode("strong", `${date}${day.key === today ? " · Today" : ""}`),
    );
    const counts = sources
      .filter((source) => prefs.sources.includes(source))
      .map((source) => {
        const count = day.items.filter((item) => item.source === source).length;
        return count
          ? `${count} ${source === "manual" ? "manual" : source === "git" ? "Git" : "activity"}`
          : "";
      })
      .filter(Boolean);
    heading.append(
      textNode("small", counts.join(" · ") || "No items", "muted"),
    );
    summary.append(heading);
    if (day.logged)
      summary.append(
        textNode(
          "span",
          `${formatDuration(day.logged)} logged`,
          "timeline-logged",
        ),
      );
    if (day.logged > day.covered)
      summary.title = `Task time includes parallel entries. ${formatDuration(day.covered)} elapsed.`;
    section.append(summary);
    if (!day.items.length)
      section.append(
        textNode(
          "p",
          prefs.sources.length
            ? "No items from the selected sources."
            : "Choose a source in Filters.",
          "empty",
        ),
      );
    for (const item of day.items) {
      const row = document.createElement("article");
      row.className = "timeline-item";
      row.dataset.source = item.source;
      const time = document.createElement("time");
      time.dateTime = new Date(item.start).toISOString();
      time.textContent = formatTime(item.start);
      const content = document.createElement("div");
      content.append(
        textNode("small", sourceLabels[item.source], "timeline-source"),
        textNode("p", item.title, "timeline-title"),
      );
      if (prefs.details)
        for (const detail of item.details)
          content.append(textNode("p", detail, "timeline-detail"));
      row.append(time, content);
      if (item.entryId !== undefined) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "delete";
        button.textContent = "×";
        button.setAttribute("aria-label", `Delete ${item.title} entry`);
        button.disabled = !native;
        button.addEventListener("click", () => remove(item.entryId!));
        row.append(button);
      }
      section.append(row);
    }
    section.addEventListener("toggle", () => {
      if (!section.isConnected) return;
      const expected = prefs.openDays[day.key] ?? day.key === today;
      if (section.open !== expected) toggled(day.key, section.open);
    });
    list.append(section);
  }
  if (focused)
    list
      .querySelector<HTMLElement>(`[data-timeline-day="${focused}"]`)
      ?.focus();
}
