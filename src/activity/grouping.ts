import type { Activity } from "../types";

export interface ActivityTitle {
  title: string;
  originals: string[];
  start: number;
  end: number;
  duration: number;
}
export interface ActivitySession {
  start: number;
  end: number;
  duration: number;
  titles: ActivityTitle[];
}
export interface ActivityApp {
  key: string;
  app: string;
  kind: string;
  duration: number;
  sessions: ActivitySession[];
}

function displayTitle(row: Activity): string {
  let title = row.title.trim().replace(/\s+/g, " ");
  if (row.app.toLowerCase() === "slack.exe") {
    title = title
      .replace(/^!\s*/, "")
      .replace(/\s+-\s+\d+\s+new items?(?=\s+-\s+Slack(?:\s|$))/gi, "")
      .replace(/\s+[🔊🔔]+\s*$/u, "")
      .trim();
  }
  return title;
}

export function groupActivity(rows: Activity[]): ActivityApp[] {
  const apps = new Map<string, ActivityApp>();
  let previousKey = "";
  let session: ActivitySession | undefined;
  const ordered = [...rows].sort(
    (a, b) => a.start - b.start || a.end - b.end || a.id - b.id,
  );
  for (const row of ordered) {
    if (
      !Number.isFinite(row.start) ||
      !Number.isFinite(row.end) ||
      row.end <= row.start ||
      row.kind === "hud"
    )
      continue;
    const key = `${row.kind}:${row.app.toLowerCase()}`;
    let app = apps.get(key);
    if (!app) {
      app = { key, app: row.app, kind: row.kind, duration: 0, sessions: [] };
      apps.set(key, app);
    }
    if (!session || key !== previousKey || row.start > session.end) {
      session = { start: row.start, end: row.start, duration: 0, titles: [] };
      app.sessions.push(session);
    }
    // Count only recorded intervals, never gaps or repeated/overlapping samples.
    const duration = Math.max(0, row.end - Math.max(row.start, session.end));
    const title = displayTitle(row);
    const last = session.titles.at(-1);
    if (last && last.title === title && row.start <= last.end) {
      last.end = Math.max(last.end, row.end);
      last.duration += duration;
      if (!last.originals.includes(row.title)) last.originals.push(row.title);
    } else if (duration > 0) {
      session.titles.push({
        title,
        originals: [row.title],
        start: row.start,
        end: row.end,
        duration,
      });
    }
    session.end = Math.max(session.end, row.end);
    session.duration += duration;
    app.duration += duration;
    previousKey = key;
  }
  for (const app of apps.values()) {
    app.sessions.reverse();
    for (const block of app.sessions) block.titles.reverse();
  }
  return [...apps.values()].sort(
    (a, b) => b.sessions[0].end - a.sessions[0].end,
  );
}
