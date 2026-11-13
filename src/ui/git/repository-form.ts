import {
  inspectRepository,
  pickRepositoryFolder,
  saveRepository,
} from "../../git/api";
import { currentWeekStart, dateValue, localDayRange } from "../../git/dates";
import type { GitRepository } from "../../git/types";
import { el, input } from "../../utils/dom";

interface FormContext {
  native: boolean;
  run(work: () => Promise<void>): Promise<void>;
  saved(id: number): Promise<void>;
  status(message: string, error?: boolean): void;
}

export function initRepositoryForm(context: FormContext) {
  const form = el<HTMLFormElement>("git-repository-form");
  const project = el<HTMLSelectElement>("git-project");
  let editingId: number | null = null;
  let repositories: GitRepository[] = [];
  let busy = false;
  let hasProjects = false;

  function setBusy(value: boolean) {
    busy = value;
    for (const field of form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLButtonElement
    >("input,select,button"))
      field.disabled = value;
    input("git-authors").disabled = value || input("git-all-authors").checked;
    for (const id of ["git-save", "git-inspect", "git-browse"])
      el<HTMLButtonElement>(id).disabled =
        value || !context.native || (id === "git-save" && !hasProjects);
  }

  function reset() {
    editingId = null;
    form.reset();
    input("git-from").value = currentWeekStart();
    input("git-from").max = dateValue();
    project.value = input("project").value;
    el("git-setup-title").textContent = "Add repository";
    setBusy(busy);
  }

  function edit(repo: GitRepository) {
    editingId = repo.id;
    input("git-path").value = repo.path;
    project.value = repo.project;
    input("git-from").value = repo.importFrom;
    input("git-authors").value = repo.authors.join(", ");
    input("git-all-authors").checked = repo.allAuthors;
    el("git-setup-title").textContent = `Edit ${repo.name}`;
    el<HTMLDetailsElement>("git-setup").open = true;
    setBusy(busy);
  }

  function render(values: GitRepository[], projects: string[]) {
    input("git-from").max = dateValue();
    repositories = values;
    hasProjects = projects.length > 0;
    const selected = project.value;
    project.replaceChildren(
      Object.assign(document.createElement("option"), {
        value: "",
        textContent: "Choose a saved project/task",
      }),
      ...projects.map((name) =>
        Object.assign(document.createElement("option"), {
          value: name,
          textContent: name,
        }),
      ),
    );
    project.value = selected || input("project").value;
    el("git-recent-paths").replaceChildren(
      ...values.map((repo) =>
        Object.assign(document.createElement("option"), {
          value: repo.path,
          label: repo.name,
        }),
      ),
    );
    if (editingId !== null && !values.some((repo) => repo.id === editingId))
      reset();
    if (!values.length) el<HTMLDetailsElement>("git-setup").open = true;
    setBusy(busy);
  }

  async function inspect() {
    if (!input("git-path").value.trim())
      throw new Error("Enter a repository folder first");
    const result = await inspectRepository(input("git-path").value);
    const existing = repositories.find(
      (repo) => repo.path.toLowerCase() === result.path.toLowerCase(),
    );
    if (existing) edit(existing);
    else {
      input("git-path").value = result.path;
      input("git-authors").value = result.authors.join(", ");
    }
    context.status(
      result.authors.length
        ? `Read ${result.name}. Review the project, import date, and authors, then save.`
        : `Read ${result.name}. Add your author email or choose All authors.`,
    );
  }

  el("git-inspect").addEventListener("click", () => void context.run(inspect));
  el("git-browse").addEventListener(
    "click",
    () =>
      void context.run(async () => {
        const path = await pickRepositoryFolder();
        if (path) {
          input("git-path").value = path;
          await inspect();
        }
      }),
  );
  input("git-all-authors").addEventListener("change", () => setBusy(busy));
  el("git-new").addEventListener("click", () => {
    reset();
    input("git-path").focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    void context.run(async () => {
      const importFrom = input("git-from").value;
      const id = await saveRepository({
        id: editingId,
        path: input("git-path").value.trim(),
        project: project.value,
        importFrom,
        since: localDayRange(importFrom).from,
        authors: input("git-authors")
          .value.split(/[,;\s]+/)
          .filter(Boolean),
        allAuthors: input("git-all-authors").checked,
      });
      editingId = id;
      await context.saved(id);
      el<HTMLDetailsElement>("git-setup").open = false;
    });
  });
  reset();
  return { render, edit, reset, setBusy };
}
