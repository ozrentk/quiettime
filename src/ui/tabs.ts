import { el, input } from "../utils/dom";

const sections = [
  "general",
  "entries",
  "git",
  "activity",
  "preferences",
] as const;
export type Section = (typeof sections)[number];

export function initTabs(onChange: (section: Section) => void) {
  let selected: Section = "general";
  const scrollPositions = new Map<Section, number>();
  const content = document.querySelector("main")!;

  function select(section: Section) {
    scrollPositions.set(selected, content.scrollTop);
    selected = section;
    for (const value of sections) {
      const active = value === section;
      el(`${value}-tab`).setAttribute("aria-selected", String(active));
      el(`${value}-tab`).tabIndex = active ? 0 : -1;
      el(`${value}-panel`).hidden = !active;
    }
    content.scrollTop = scrollPositions.get(section) ?? 0;
    onChange(section);
  }

  for (const section of sections) {
    const button = el(`${section}-tab`);
    button.addEventListener("click", () => select(section));
    button.addEventListener("keydown", (event) => {
      const index = sections.indexOf(section);
      const next =
        event.key === "ArrowRight"
          ? (index + 1) % sections.length
          : event.key === "ArrowLeft"
            ? (index + sections.length - 1) % sections.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? sections.length - 1
                : null;
      if (next === null) return;
      event.preventDefault();
      select(sections[next]);
      el(`${selected}-tab`).focus();
    });
  }
  select("general");
  return {
    focusActive() {
      if (selected === "general") input("project").focus();
      else el(`${selected}-tab`).focus();
    },
  };
}
