import {
  inspectRepository,
  pickRepositoryFolder,
  saveRepository,
} from "../../git/api";
import { currentWeekStart, dateValue, localDayRange } from "../../git/dates";
import type { GitRepository } from "../../git/types";
import { el, input } from "../../utils/dom";
import type { ProjectSelector } from "../project-selector";

interface FormContext {
  native: boolean;
  run(work: () => Promise<void>): Promise<void>;
  saved(id: number): Promise<void>;
  status(message: string, error?: boolean): void;
  projectSelector: ProjectSelector;
}

export function initRepositoryForm(context: FormContext) {
  const dialog = el<HTMLDialogElement>("git-dialog");
  const form = el<HTMLFormElement>("git-repository-form");
  const project = input("git-project");
  let editingId: number | null = null;
  let repositories: GitRepository[] = [];
  let busy = false;
  let opener: HTMLElement | null = null;

  const focus = () => input("git-path").focus();
  function open() {
    if (dialog.open) return;
    opener = document.activeElement as HTMLElement | null;
    context.status("");
    dialog.showModal();
    focus();
  }

  function dismiss() {
    context.projectSelector.close();
    dialog.close();
    if (opener instanceof HTMLButtonElement && opener.disabled)
      el("git-tab").focus();
    else (opener ?? el("git-add")).focus();
  }

  function close() {
    if (!busy) dismiss();
  }

  function setBusy(value: boolean) {
    busy = value;
    el<HTMLButtonElement>("git-dialog-close").disabled = value;
    for (const field of form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLButtonElement
    >("input,select,button"))
      field.disabled = value;
    input("git-authors").disabled = value || input("git-all-authors").checked;
    for (const id of ["git-save", "git-inspect", "git-browse"])
      el<HTMLButtonElement>(id).disabled = value || !context.native;
    context.projectSelector.setDisabled(value);
  }

  function reset() {
    editingId = null;
    form.reset();
    input("git-from").value = currentWeekStart();
    input("git-from").max = dateValue();
    project.value = input("project").value;
    el("git-dialog-heading").textContent = "Add repository";
    setBusy(busy);
  }

  function edit(repo: GitRepository) {
    editingId = repo.id;
    input("git-path").value = repo.path;
    project.value = repo.project;
    input("git-from").value = repo.importFrom;
    input("git-authors").value = repo.authors.join(", ");
    input("git-all-authors").checked = repo.allAuthors;
    el("git-dialog-heading").textContent = "Edit repository";
    setBusy(busy);
    open();
  }

  function render(values: GitRepository[], projects: string[]) {
    input("git-from").max = dateValue();
    repositories = values;
    context.projectSelector.render(projects);
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
  el("git-add").addEventListener("click", () => {
    if (busy) return;
    reset();
    open();
  });
  for (const id of ["git-dialog-close", "git-dialog-cancel"])
    el(id).addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (context.projectSelector.isOpen()) context.projectSelector.close();
    else close();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    void context.run(async () => {
      const importFrom = input("git-from").value;
      const id = await saveRepository({
        id: editingId,
        path: input("git-path").value.trim(),
        project: project.value.trim(),
        importFrom,
        since: localDayRange(importFrom).from,
        authors: input("git-authors")
          .value.split(/[,;\s]+/)
          .filter(Boolean),
        allAuthors: input("git-all-authors").checked,
      });
      editingId = id;
      dismiss();
      await context.saved(id);
    });
  });
  reset();
  return { render, edit, reset, setBusy, isOpen: () => dialog.open, focus };
}
