import { el, textNode } from "../utils/dom";

export function mountProjectSelectors() {
  const template = el<HTMLTemplateElement>("project-selector-template");
  for (const host of document.querySelectorAll<HTMLElement>(
    "[data-project-selector]",
  )) {
    const prefix = host.dataset.prefix ?? "";
    host.append(template.content.cloneNode(true));
    host.querySelector(".project-selector")!.id = `${prefix}project-selector`;
    const field = host.querySelector<HTMLInputElement>("input")!;
    field.id = `${prefix}project`;
    field.setAttribute("aria-controls", `${prefix}project-options`);
    const toggle = host.querySelector(".project-toggle")!;
    toggle.id = `${prefix}browse-projects`;
    toggle.setAttribute("aria-controls", `${prefix}project-options`);
    host.querySelector(".project-picker")!.id = `${prefix}project-picker`;
    host.querySelector(".project-options")!.id = `${prefix}project-options`;
    host.querySelector(".project-status")!.id = `${prefix}project-status`;
  }
}

interface Options {
  create(name: string): Promise<string | undefined>;
  change(): void;
  opening(): void;
}

export function initProjectSelector(prefix: string, options: Options) {
  const root = el(`${prefix}project-selector`);
  const field = el<HTMLInputElement>(`${prefix}project`);
  const toggle = el<HTMLButtonElement>(`${prefix}browse-projects`);
  const picker = el(`${prefix}project-picker`);
  const list = el(`${prefix}project-options`);
  let projects: string[] = [];
  let query = "";
  let active = -1;
  let disabled = false;
  let saving = false;
  let choices: Array<{ label: string; value?: string; create?: string }> = [];
  const isOpen = () => !picker.hidden;

  function close() {
    picker.hidden = true;
    active = -1;
    query = "";
    field.placeholder = "Select or add a project/task…";
    field.removeAttribute("aria-activedescendant");
    field.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-expanded", "false");
  }

  function setDisabled(value: boolean) {
    disabled = value;
    field.disabled = value || saving;
    toggle.disabled = value || saving;
    for (const button of list.querySelectorAll<HTMLButtonElement>("button"))
      button.disabled = value || saving;
    if (value) close();
  }

  function highlight() {
    [...list.querySelectorAll<HTMLElement>("[role=option]")].forEach(
      (button, index) => {
        button.setAttribute("aria-selected", String(index === active));
        button.classList.toggle("active", index === active);
      },
    );
    const current = list.querySelectorAll<HTMLElement>("[role=option]")[active];
    if (current) {
      field.setAttribute("aria-activedescendant", current.id);
      current.scrollIntoView?.({ block: "nearest" });
    } else field.removeAttribute("aria-activedescendant");
  }

  async function choose(index: number) {
    if (disabled || saving) return;
    const choice = choices[index];
    if (!choice) return;
    if (choice.value !== undefined) {
      field.value = choice.value;
      options.change();
      close();
      field.focus();
    } else if (choice.create) {
      saving = true;
      setDisabled(disabled);
      try {
        const saved = await options.create(choice.create);
        if (saved !== undefined) {
          field.value = saved;
          options.change();
          close();
        }
      } finally {
        saving = false;
        setDisabled(disabled);
        field.focus();
      }
    } else {
      field.value = "";
      field.placeholder = "Enter a new project/task name…";
      options.change();
      query = "";
      draw();
      field.focus();
    }
  }

  function draw() {
    const typed = field.value.trim();
    const existing = projects.some(
      (name) => name.toLocaleLowerCase() === typed.toLocaleLowerCase(),
    );
    choices = projects
      .filter((name) =>
        name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      )
      .map((value) => ({ label: value, value }));
    choices.push(
      typed && !existing
        ? { label: `Add “${typed}”`, create: typed }
        : { label: "Add new project/task…" },
    );
    active = -1;
    list.replaceChildren();
    if (choices.length === 1)
      list.append(textNode("p", "No saved projects match.", "muted"));
    choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.id = `${prefix}project-option-${index}`;
      button.tabIndex = -1;
      button.setAttribute("role", "option");
      button.textContent = choice.label;
      button.disabled = disabled || saving;
      if (choice.value === undefined) button.className = "project-add-option";
      button.addEventListener("pointerdown", (event) => event.preventDefault());
      button.addEventListener("click", () => void choose(index));
      list.append(button);
    });
    highlight();
  }

  function open(filter: string) {
    if (disabled || saving) return;
    if (!isOpen()) options.opening();
    query = filter;
    picker.hidden = false;
    field.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-expanded", "true");
    draw();
  }

  field.addEventListener("input", () => {
    options.change();
    open(field.value.trim());
  });
  toggle.addEventListener("click", () => {
    if (isOpen()) close();
    else open("");
    field.focus();
  });
  root.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      event.stopPropagation();
      close();
      field.focus();
    }
    if (event.target !== field) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen()) open("");
      active =
        event.key === "ArrowDown"
          ? (active + 1) % choices.length
          : active < 0
            ? choices.length - 1
            : (active + choices.length - 1) % choices.length;
      highlight();
    } else if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat || disabled || saving) return;
      if (isOpen() && active >= 0) void choose(active);
      else {
        open(field.value.trim());
        const exact = choices.findIndex(
          (choice) =>
            choice.value?.toLocaleLowerCase() ===
            field.value.trim().toLocaleLowerCase(),
        );
        void choose(exact >= 0 ? exact : choices.length - 1);
      }
    } else if (event.key === "Tab") close();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!root.contains(event.target as Node)) close();
  });
  root.closest("dialog")?.addEventListener("close", close);
  return {
    close,
    isOpen,
    setDisabled,
    render(values: string[]) {
      if (
        projects.length === values.length &&
        projects.every((name, index) => name === values[index])
      )
        return;
      projects = [...values];
      if (isOpen() && !saving) draw();
    },
  };
}

export type ProjectSelector = ReturnType<typeof initProjectSelector>;
