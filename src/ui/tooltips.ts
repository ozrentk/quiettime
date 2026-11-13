export function initTooltips() {
  let active: HTMLElement | null = null;
  let closeTimer: number | undefined;

  function close() {
    window.clearTimeout(closeTimer);
    if (!active) return;
    active.querySelector<HTMLElement>(".info-tooltip")!.hidden = true;
    active.querySelector("button")!.setAttribute("aria-expanded", "false");
    active = null;
  }

  function open(help: HTMLElement) {
    window.clearTimeout(closeTimer);
    if (active !== help) close();
    active = help;
    const button = help.querySelector<HTMLButtonElement>(".info-button")!;
    const tip = help.querySelector<HTMLElement>(".info-tooltip")!;
    tip.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const rect = button.getBoundingClientRect();
    const width = tip.getBoundingClientRect().width;
    const height = tip.getBoundingClientRect().height;
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - width - 8),
    );
    const top =
      rect.bottom + height + 8 <= window.innerHeight
        ? rect.bottom + 6
        : Math.max(8, rect.top - height - 6);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  document.addEventListener("pointerover", (event) => {
    const help = (event.target as Element).closest<HTMLElement>(".help");
    if (help && !help.querySelector<HTMLButtonElement>("button")!.disabled)
      open(help);
  });
  document.addEventListener("pointerout", (event) => {
    if (!active) return;
    if (
      event.relatedTarget instanceof Node &&
      active.contains(event.relatedTarget)
    )
      return;
    if (active.contains(document.activeElement)) return;
    // Allow crossing the small gap between the icon and its tooltip.
    closeTimer = window.setTimeout(close, 150);
  });
  document.addEventListener("focusin", (event) => {
    const help = (event.target as Element).closest<HTMLElement>(".help");
    if (help) open(help);
    else close();
  });
  document.addEventListener("focusout", (event) => {
    if (
      active &&
      !(
        event.relatedTarget instanceof Node &&
        active.contains(event.relatedTarget)
      )
    )
      close();
  });
  document.addEventListener("click", (event) => {
    const help = (event.target as Element).closest<HTMLElement>(".help");
    if (help) open(help);
    else close();
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && active) {
        close();
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );
  document.addEventListener("scroll", close, true);
  document.addEventListener("close", close, true);
  window.addEventListener("resize", close);
}
