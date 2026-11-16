import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

process.env.TZ = "Europe/Zagreb";
const bundled = await build({
  stdin: {
    contents:
      'export * from "./src/timeline/model"; export * from "./src/timeline/dates"; export * from "./src/timeline/preferences";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
});
const loaded = { exports: {} };
new Function("module", "exports", bundled.outputFiles[0].text)(
  loaded,
  loaded.exports,
);
const { buildTimeline, weekDays, shiftWeek, loadTimelinePreferences } =
  loaded.exports;
const at = (date) => new Date(date).getTime();
const blank = () => ({ entries: [], activity: [], commits: [] });

test("calendar weeks include all seven days across DST and year boundaries", () => {
  for (const [date, hours] of [
    ["2026-03-29", 167],
    ["2026-10-25", 169],
    ["2026-11-13", 168],
  ]) {
    const days = weekDays(date);
    assert.equal(days.length, 7);
    assert.equal(new Date(days[0].from).getDay(), 1);
    assert.equal((days[6].to - days[0].from) / 3600000, hours);
    days
      .slice(1)
      .forEach((day, index) => assert.equal(day.from, days[index].to));
  }
  assert.equal(shiftWeek("2026-01-01", -1), "2025-12-25");
  assert.throws(() => weekDays("2026-02-30"));
});

test("cross-midnight manual time is allocated once per day; other sources never inflate totals", () => {
  const data = blank();
  data.entries = [
    {
      id: 1,
      project: "Project",
      note: "Review",
      start: at("2026-11-09T23:30:00"),
      end: at("2026-11-10T00:30:00"),
    },
  ];
  data.activity = [
    {
      id: 2,
      app: "code.exe",
      title: "file.ts",
      kind: "active",
      start: at("2026-11-09T23:45:00"),
      end: at("2026-11-10T00:15:00"),
    },
  ];
  const days = buildTimeline("2026-11-13", data, ["manual", "git", "activity"]);
  assert.equal(days[0].logged, 30 * 60000);
  assert.equal(days[1].logged, 30 * 60000);
  assert.equal(
    days.reduce((sum, day) => sum + day.logged, 0),
    60 * 60000,
  );
  assert.equal(
    days[0].items.filter((item) => item.source === "activity").length,
    1,
  );
  assert.equal(
    days[1].items.filter((item) => item.source === "activity").length,
    1,
  );
  const excluded = buildTimeline("2026-11-13", data, ["activity"]);
  assert.equal(
    excluded.reduce((sum, day) => sum + day.logged, 0),
    0,
  );
  assert(
    buildTimeline("2026-11-13", data, []).every((day) => !day.items.length),
  );
});

test("activity uses recorded sessions; Git preserves all commits, including equal hashes in different repos", () => {
  const data = blank();
  const start = at("2026-11-09T09:00:00");
  data.activity = [
    {
      id: 1,
      app: "code.exe",
      title: "A",
      kind: "active",
      start,
      end: start + 60000,
    },
    {
      id: 2,
      app: "code.exe",
      title: "A",
      kind: "active",
      start: start + 60000,
      end: start + 120000,
    },
    {
      id: 3,
      app: "code.exe",
      title: "B",
      kind: "active",
      start: start + 180000,
      end: start + 240000,
    },
  ];
  data.commits = Array.from({ length: 1002 }, (_, i) => ({
    repositoryId: i,
    repository: "Repo",
    project: "Project",
    sha: "same-sha",
    subject: "Commit",
    authorName: "Author",
    authorEmail: "author@test",
    committedAt: start + i,
    authoredAt: start + i,
  }));
  const day = buildTimeline("2026-11-13", data, ["activity", "git"])[0];
  assert.equal(day.items.filter((item) => item.source === "git").length, 1002);
  assert.equal(
    new Set(
      day.items.filter((item) => item.source === "git").map((item) => item.key),
    ).size,
    1002,
  );
  assert.equal(
    day.items.filter((item) => item.source === "activity").length,
    2,
  );
  assert.equal(
    day.items
      .find((item) => item.source === "activity")
      .details.filter((detail) => detail.startsWith("A")).length,
    1,
  );
  assert(
    day.items.every(
      (item, i) => i === 0 || item.start >= day.items[i - 1].start,
    ),
  );
});

test("preferences tolerate malformed storage and preserve intentionally empty filters", () => {
  globalThis.localStorage = { getItem: () => "broken" };
  assert.equal(loadTimelinePreferences().sources.length, 3);
  globalThis.localStorage = {
    getItem: () =>
      JSON.stringify({
        sources: [],
        details: true,
        openDays: { "2026-11-13": false, garbage: true },
      }),
  };
  const prefs = loadTimelinePreferences();
  assert.deepEqual(prefs.sources, []);
  assert.equal(prefs.details, true);
  assert.deepEqual(prefs.openDays, { "2026-11-13": false });
  delete globalThis.localStorage;
});

test("parallel tasks retain separate durations while elapsed coverage excludes overlap", () => {
  const data = blank();
  data.entries = [
    {
      id: 1,
      project: "Task A",
      note: "",
      start: at("2026-11-09T23:00:00"),
      end: at("2026-11-10T01:00:00"),
    },
    {
      id: 2,
      project: "Task B",
      note: "",
      start: at("2026-11-09T23:30:00"),
      end: at("2026-11-10T00:30:00"),
    },
    {
      id: 3,
      project: "Task A",
      note: "Parallel entry",
      start: at("2026-11-09T23:30:00"),
      end: at("2026-11-10T00:30:00"),
    },
  ];
  const days = buildTimeline("2026-11-13", data, ["manual"]);
  assert.equal(days[0].items.length, 3);
  assert.equal(days[1].items.length, 3);
  assert.equal(days[0].logged, 2 * 3600000);
  assert.equal(days[1].logged, 2 * 3600000);
  assert.equal(days[0].covered, 3600000);
  assert.equal(days[1].covered, 3600000);
  const excluded = buildTimeline("2026-11-13", data, ["git"]);
  assert(excluded.every((day) => day.logged === 0 && day.covered === 0));
});
