export function initDashboardRefresh(refresh: () => Promise<void>) {
  let seconds = 5;
  let timer: number | undefined;
  let running = false;
  let enabled = false;
  function schedule() {
    window.clearTimeout(timer);
    if (enabled && !document.hidden)
      timer = window.setTimeout(tick, seconds * 1000);
  }
  async function tick() {
    running = true;
    try {
      if (!document.hidden) await refresh();
    } finally {
      running = false;
      schedule();
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (!running) schedule();
  });
  return {
    start() {
      enabled = true;
      schedule();
    },
    setSeconds(value: number) {
      if (
        !Number.isInteger(value) ||
        value < 1 ||
        value > 60 ||
        value === seconds
      )
        return;
      seconds = value;
      if (!running && enabled) schedule();
    },
  };
}
