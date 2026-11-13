import { invoke } from "@tauri-apps/api/core";
import { el, input, textNode } from "../utils/dom";
import type { UIContext } from "./context";
import { showStatus } from "./status";

export interface ProjectSelectionController {
  close(): void;
  render(projects: string[]): void;
  isOpen(prefix?: string): boolean;
}

export function initProjectSelection(
  context: UIContext,
  saveDefaults: () => void,
): ProjectSelectionController {
  let projects: string[] = [];
  const prefixes = ["", "manual-"];
  const isOpen = (prefix = "") => !el(prefix + "project-picker").hidden;

  function close() {
    for (const prefix of prefixes) {
      el(prefix + "project-picker").hidden = true;
      el(prefix + "browse-projects").setAttribute("aria-expanded", "false");
    }
  }

  function renderOptions() {
    el("projects").replaceChildren(
      ...projects.map((project) =>
        Object.assign(document.createElement("option"), { value: project }),
      ),
    );
    for (const prefix of prefixes) {
      const list = el(prefix + "project-options");
      list.replaceChildren();
      if (!projects.length)
        list.append(textNode("p", "No saved projects.", "muted"));
      for (const project of projects) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = project;
        button.addEventListener("click", () => {
          input(prefix + "project").value = project;
          if (!prefix) saveDefaults();
          close();
          input(prefix + "project").focus();
        });
        list.append(button);
      }
    }
  }

  function render(values: string[]) {
    projects = values;
    if (prefixes.every((prefix) => !isOpen(prefix))) renderOptions();
  }

  for (const prefix of prefixes) {
    input(prefix + "project").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      if (event.isComposing || event.repeat) return;
      void context.run(async () => {
        if (!context.native)
          throw new Error("Open the Windows app to save projects.");
        const name = await invoke<string>("save_project", {
          name: input(prefix + "project").value,
        });
        input(prefix + "project").value = name;
        if (!prefix) saveDefaults();
        close();
        await context.refresh();
        const message = `Project saved: ${name}`;
        if (prefix) el(prefix + "project-status").textContent = message;
        else showStatus(message);
        input(prefix + "project").focus();
      });
    });
    el(prefix + "browse-projects").addEventListener("click", () => {
      const open = !isOpen(prefix);
      if (open) renderOptions();
      el(prefix + "project-picker").hidden = !open;
      el(prefix + "browse-projects").setAttribute(
        "aria-expanded",
        String(open),
      );
    });
  }
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (
      !target.closest(".project-picker") &&
      !target.closest("#browse-projects") &&
      !target.closest("#manual-browse-projects")
    )
      close();
  });
  return { close, render, isOpen };
}
