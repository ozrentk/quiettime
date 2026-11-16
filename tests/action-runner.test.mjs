import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/ui/action-runner.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
});
const module = { exports: {} };
new Function("module", "exports", bundle.outputFiles[0].text)(
  module,
  module.exports,
);
const { createActionRunner } = module.exports;

test("a queued Enter action runs after the current save, exactly once", async () => {
  const events = [];
  const runner = createActionRunner({
    start() {},
    end() {},
    error(error) {
      throw error;
    },
  });
  let finish;
  const first = runner.run(async () => {
    events.push("first");
    await new Promise((resolve) => {
      finish = resolve;
    });
    events.push("first done");
  });
  const queued = runner.run(
    async () => {
      events.push("note");
    },
    { queue: true },
  );
  await runner.run(async () => {
    events.push("duplicate");
  });
  assert.deepEqual(events, ["first"]);
  finish();
  await Promise.all([first, queued]);
  assert.deepEqual(events, ["first", "first done", "note"]);
  assert.equal(runner.isBusy(), false);
});

test("a failed operation releases queued saves and does not leave the UI busy", async () => {
  const errors = [],
    events = [];
  const runner = createActionRunner({
    start() {},
    end() {},
    error(error) {
      errors.push(error.message);
    },
  });
  let reject;
  const first = runner.run(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const queued = runner.run(
    async () => {
      events.push("saved");
    },
    { queue: true },
  );
  reject(new Error("Project save failed"));
  await Promise.all([first, queued]);
  assert.deepEqual(errors, ["Project save failed"]);
  assert.deepEqual(events, ["saved"]);
  assert.equal(runner.isBusy(), false);
});
