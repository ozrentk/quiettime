export interface RunOptions {
  queue?: boolean;
}
export function createActionRunner(callbacks: {
  start(): void;
  error(error: unknown): void;
  end(): void;
}) {
  let busy = false;
  let finished = Promise.resolve();
  async function run(
    work: () => Promise<void>,
    options: RunOptions = {},
  ): Promise<void> {
    if (busy) {
      if (!options.queue) return;
      await finished;
      return run(work, options);
    }
    busy = true;
    let release!: () => void;
    finished = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      callbacks.start();
      await work();
    } catch (error) {
      callbacks.error(error);
    } finally {
      busy = false;
      try {
        callbacks.end();
      } finally {
        release();
      }
    }
  }
  return { run, isBusy: () => busy };
}
