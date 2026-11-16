import { groupActivity } from "../activity/grouping";
import type { GitCommit } from "../git/types";
import type { Activity, Entry } from "../types";
import { formatDuration, formatTime } from "../utils/time";
import { weekDays } from "./dates";
import { coveredDuration } from "../utils/intervals";

export const sources = ["manual", "git", "activity"] as const;
export type Source = (typeof sources)[number];
export const sourceLabels: Record<Source, string> = {
  manual: "Manual entries",
  git: "Git",
  activity: "Activity",
};
export interface TimelineSnapshot {
  entries: Entry[];
  activity: Activity[];
  commits: GitCommit[];
}
export interface TimelineItem {
  key: string;
  source: Source;
  start: number;
  end: number;
  title: string;
  details: string[];
  entryId?: number;
}
export interface TimelineDay {
  key: string;
  from: number;
  to: number;
  items: TimelineItem[];
  logged: number;
  covered: number;
}
export function buildTimeline(
  anchor: string,
  data: TimelineSnapshot,
  selected: Source[],
): TimelineDay[] {
  return weekDays(anchor).map((day) => {
    const items: TimelineItem[] = [];
    let logged = 0;
    if (selected.includes("manual"))
      for (const entry of data.entries) {
        const start = Math.max(day.from, entry.start),
          end = Math.min(day.to, entry.end);
        if (end <= start) continue;
        logged += end - start;
        items.push({
          key: `manual:${entry.id}:${day.key}`,
          source: "manual",
          start,
          end,
          entryId: entry.id,
          title: `${entry.project} · ${formatDuration(end - start)}`,
          details: [
            `${formatTime(entry.start)} – ${formatTime(entry.end)}`,
            entry.note,
          ].filter(Boolean),
        });
      }
    if (selected.includes("git"))
      for (const commit of data.commits) {
        if (commit.committedAt < day.from || commit.committedAt >= day.to)
          continue;
        items.push({
          key: `git:${commit.repositoryId}:${commit.sha}`,
          source: "git",
          start: commit.committedAt,
          end: commit.committedAt,
          title: commit.subject || "(No commit subject)",
          details: [
            `${commit.repository} · ${commit.project}`,
            `${commit.authorName} <${commit.authorEmail}> · ${commit.sha.slice(0, 8)}`,
          ],
        });
      }
    if (selected.includes("activity")) {
      const rows = data.activity
        .filter((row) => row.start < day.to && row.end > day.from)
        .map((row) => ({
          ...row,
          start: Math.max(row.start, day.from),
          end: Math.min(row.end, day.to),
        }));
      for (const app of groupActivity(rows))
        for (const session of app.sessions) {
          items.push({
            key: `activity:${app.key}:${session.start}`,
            source: "activity",
            start: session.start,
            end: session.end,
            title: `${app.kind === "idle" ? "Idle" : app.app} · ${formatDuration(session.duration)}`,
            details: [
              `${formatTime(session.start)} – ${formatTime(session.end)}`,
              ...[...session.titles]
                .reverse()
                .filter((title) => title.title)
                .map(
                  (title) =>
                    `${title.title} · ${formatDuration(title.duration)}`,
                ),
            ],
          });
        }
    }
    items.sort((a, b) => a.start - b.start || a.key.localeCompare(b.key));
    const covered = coveredDuration(
      items.filter((item) => item.source === "manual"),
    );
    return { ...day, items, logged, covered };
  });
}
