import { dateValue } from "../../git/dates";
import { el, input } from "../../utils/dom";
import { sources, type Source } from "../../timeline/model";
import type { TimelinePreferences } from "../../timeline/preferences";

interface Actions {
  navigate(direction: number): void;
  chooseDate(value: string): void;
  today(): void;
  sources(values: Source[]): void;
  details(): void;
  expand(): void;
}
export function initTimelineControls(actions: Actions) {
  const filter = el<HTMLButtonElement>("timeline-filter");
  const panel = el("timeline-filters");
  function close() {
    panel.hidden = true;
    filter.setAttribute("aria-expanded", "false");
  }
  filter.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    filter.setAttribute("aria-expanded", String(!panel.hidden));
  });
  document.addEventListener("pointerdown", (event) => {
    if (
      !panel.contains(event.target as Node) &&
      !filter.contains(event.target as Node)
    )
      close();
  });
  // Dismiss the panel before the application's Escape-to-hide handler runs.
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        close();
        filter.focus();
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );
  for (const source of sources)
    input(`timeline-source-${source}`).addEventListener("change", () => {
      actions.sources(
        sources.filter((value) => input(`timeline-source-${value}`).checked),
      );
    });
  el("timeline-previous").addEventListener("click", () => actions.navigate(-1));
  el("timeline-next").addEventListener("click", () => actions.navigate(1));
  el("timeline-today").addEventListener("click", actions.today);
  input("timeline-date").addEventListener("change", () => {
    if (input("timeline-date").value && input("timeline-date").reportValidity())
      actions.chooseDate(input("timeline-date").value);
  });
  el("timeline-details").addEventListener("click", actions.details);
  el("timeline-expand").addEventListener("click", actions.expand);
  return {
    close,
    render(
      from: number,
      to: number,
      prefs: TimelinePreferences,
      allOpen: boolean,
    ) {
      input("timeline-date").value = dateValue(new Date(from));
      el("timeline-week").textContent =
        `${new Date(from).toLocaleDateString([], { month: "short", day: "numeric" })} – ${new Date(to - 1).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}`;
      for (const source of sources)
        input(`timeline-source-${source}`).checked =
          prefs.sources.includes(source);
      const count = el("timeline-filter-count");
      count.hidden = prefs.sources.length === sources.length;
      count.textContent = `${prefs.sources.length}/${sources.length}`;
      filter.setAttribute(
        "aria-label",
        `Filter sources, ${prefs.sources.length} of ${sources.length} selected`,
      );
      for (const [id, enabled, label] of [
        [
          "timeline-expand",
          allOpen,
          allOpen ? "Collapse all days" : "Expand all days",
        ],
        [
          "timeline-details",
          prefs.details,
          prefs.details ? "Hide details" : "Show details",
        ],
      ] as const) {
        const button = el(id);
        button.setAttribute("aria-pressed", String(enabled));
        button.setAttribute("aria-label", label);
        button.title = label;
      }
    },
  };
}
