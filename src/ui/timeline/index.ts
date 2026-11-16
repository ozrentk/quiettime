import { invoke } from "@tauri-apps/api/core";
import { dateValue } from "../../git/dates";
import { shiftWeek, weekDays } from "../../timeline/dates";
import {
  buildTimeline,
  type Source,
  type TimelineSnapshot,
} from "../../timeline/model";
import {
  loadTimelinePreferences,
  saveTimelinePreferences,
} from "../../timeline/preferences";
import { el } from "../../utils/dom";
import { formatDuration } from "../../utils/time";
import type { UIContext } from "../context";
import { initTimelineControls } from "./controls";
import { renderTimeline } from "./view";

const empty = (): TimelineSnapshot => ({
  entries: [],
  activity: [],
  commits: [],
});
export function initTimeline(context: UIContext) {
  let active = false;
  let anchor = dateValue();
  let snapshot = empty();
  let version = 0;
  let pending = false;
  let again = false;
  let hasSnapshot = false;
  const preferences = loadTimelinePreferences();
  function changed() {
    saveTimelinePreferences(preferences);
    render();
  }
  function navigate(value: string) {
    try {
      weekDays(value);
    } catch {
      return;
    }
    anchor = value;
    version++;
    snapshot = empty();
    hasSnapshot = false;
    render();
    void refresh();
  }
  const controls = initTimelineControls({
    navigate: (direction) => navigate(shiftWeek(anchor, direction)),
    chooseDate: navigate,
    today: () => navigate(dateValue()),
    sources: (values) => {
      preferences.sources = values;
      changed();
    },
    details: () => {
      preferences.details = !preferences.details;
      changed();
    },
    expand: () => {
      const days = weekDays(anchor),
        open = !allOpen();
      for (const day of days) preferences.openDays[day.key] = open;
      changed();
    },
  });
  function allOpen() {
    return weekDays(anchor).every(
      (day) => preferences.openDays[day.key] ?? day.key === dateValue(),
    );
  }
  function render() {
    const days = buildTimeline(anchor, snapshot, preferences.sources);
    controls.render(days[0].from, days[6].to, preferences, allOpen());
    renderTimeline(
      days,
      preferences,
      (key, open) => {
        preferences.openDays[key] = open;
        saveTimelinePreferences(preferences);
        controls.render(days[0].from, days[6].to, preferences, allOpen());
      },
      (id) =>
        void context.run(async () => {
          await invoke("delete_entry", { id });
          await context.refresh();
          await refresh();
        }),
      context.native,
    );
    const logged = days.reduce((sum, day) => sum + day.logged, 0);
    const covered = days.reduce((sum, day) => sum + day.covered, 0);
    el("timeline-total").textContent = preferences.sources.includes("manual")
      ? `${logged ? formatDuration(logged) : "0m"} manually logged${logged > covered ? ` · ${formatDuration(covered)} elapsed (parallel tasks)` : ""}`
      : "Manual entries excluded";
    el("timeline-count").textContent =
      `${days.reduce((sum, day) => sum + day.items.length, 0)} items`;
  }
  async function refresh() {
    if (!active || !context.native) return;
    if (pending) {
      again = true;
      return;
    }
    pending = true;
    el("timeline-loading").hidden = hasSnapshot;
    try {
      do {
        again = false;
        const requested = version;
        const days = weekDays(anchor);
        try {
          const result = await invoke<TimelineSnapshot>("timeline_snapshot", {
            from: days[0].from,
            to: days[6].to,
          });
          if (requested !== version) {
            again = active;
            continue;
          }
          snapshot = result;
          hasSnapshot = true;
          el("timeline-error").hidden = true;
          el("timeline-error").textContent = "";
          render();
        } catch (error) {
          if (requested !== version) {
            again = active;
            continue;
          }
          el("timeline-error").hidden = false;
          el("timeline-error").textContent = `Timeline: ${String(error)}`;
        }
      } while (again && active);
    } finally {
      pending = false;
      el("timeline-loading").hidden = true;
    }
  }
  render();
  return {
    refresh,
    setActive(value: boolean) {
      const entered = value && !active;
      active = value;
      if (!active) controls.close();
      if (entered) void refresh();
    },
    openSource(source: Source, timestamp = Date.now()) {
      if (!preferences.sources.includes(source))
        preferences.sources.push(source);
      const date = dateValue(new Date(timestamp));
      preferences.openDays[date] = true;
      saveTimelinePreferences(preferences);
      navigate(date);
    },
  };
}
