import { el } from "../utils/dom";

const themes = ["green", "light", "dark", "dreamy"] as const;
type Theme = (typeof themes)[number];
const storageKey = "quiet-time.theme";

function isTheme(value: unknown): value is Theme {
  return themes.includes(value as Theme);
}

export function initAppearance() {
  const select = el<HTMLSelectElement>("colour-scheme");
  let theme: Theme = "green";
  try {
    const saved = localStorage.getItem(storageKey);
    if (isTheme(saved)) theme = saved;
  } catch {
    // Appearance remains available when browser storage is unavailable.
  }
  function apply(value: Theme) {
    document.documentElement.dataset.theme = value;
    select.value = value;
  }
  apply(theme);
  select.addEventListener("change", () => {
    if (!isTheme(select.value)) return;
    apply(select.value);
    try {
      localStorage.setItem(storageKey, select.value);
    } catch {
      // Keep the selected scheme for this session.
    }
  });
}
