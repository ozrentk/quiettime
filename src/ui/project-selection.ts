import { invoke } from "@tauri-apps/api/core";
import { el } from "../utils/dom";
import type { UIContext } from "./context";
import { showStatus } from "./status";
import { initProjectSelector, type ProjectSelector } from "./project-selector";

interface Registration {
  run?: UIContext["run"];
  status?: (message: string) => void;
  change?: () => void;
}

export interface ProjectSelectionController {
  close(): void;
  render(projects: string[]): void;
  isOpen(prefix?: string): boolean;
  register(prefix: string, options?: Registration): ProjectSelector;
}

export function initProjectSelection(
  context: UIContext,
  saveDefaults: () => void,
): ProjectSelectionController {
  const selectors = new Map<string, ProjectSelector>();
  let projects: string[] = [];
  const close = () => selectors.forEach((selector) => selector.close());
  function register(prefix: string, options: Registration = {}) {
    const selector = initProjectSelector(prefix, {
      opening: close,
      change: options.change ?? (() => {}),
      create: async (name) => {
        let saved: string | undefined;
        await (options.run ?? context.run)(async () => {
          if (!context.native)
            throw new Error("Open the Windows app to save projects.");
          saved = await invoke<string>("save_project", { name });
          await context.refresh();
          (options.status ?? showStatus)(`Project saved: ${saved}`);
        });
        return saved;
      },
    });
    selectors.set(prefix, selector);
    selector.render(projects);
    return selector;
  }
  register("", { change: saveDefaults });
  register("manual-", {
    status: (message) => {
      el("manual-project-status").textContent = message;
    },
  });
  return {
    close,
    register,
    isOpen: (prefix = "") => selectors.get(prefix)?.isOpen() ?? false,
    render(values) {
      projects = values;
      selectors.forEach((selector) => selector.render(values));
    },
  };
}
