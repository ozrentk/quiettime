import { getGitSnapshot, importCommits, removeRepository } from "../../git/api";
import { localDayRange } from "../../git/dates";
import type { GitSnapshot } from "../../git/types";
import { el, input } from "../../utils/dom";
import type { UIContext } from "../context";
import { initRepositoryForm } from "./repository-form";
import { renderGitTimeline } from "./timeline";
import { showStatus } from "../status";

export interface GitController {
  setActive(active: boolean): void;
  update(projects: string[]): void;
  refresh(): Promise<void>;
  isDialogOpen(): boolean;
  focusDialog(): void;
}

export function initGit(context: UIContext): GitController {
  let active = false;
  let pending = false;
  let loading = false;
  let loadAgain = false;
  let limit = 100;
  let projectNames: string[] = [];
  let snapshot: GitSnapshot = {
    repositories: [],
    commits: [],
    busy: false,
    hasMore: false,
  };
  const selection = el<HTMLSelectElement>("git-filter");
  const selectedId = () => (selection.value ? Number(selection.value) : null);

  function status(message: string, error = false) {
    const inDialog = el<HTMLDialogElement>("git-dialog").open;
    el("git-status").textContent = error && !inDialog ? message : "";
    el("git-dialog-error").textContent = error && inDialog ? message : "";
    el("git-dialog-error").hidden = !error || !inDialog;
    showStatus(error ? "" : message);
    el("git-status").className = error ? "git-status git-error" : "git-status";
  }

  function controls() {
    const selected = selectedId() !== null;
    el<HTMLButtonElement>("git-refresh").disabled =
      pending ||
      snapshot.busy ||
      !context.native ||
      !snapshot.repositories.length;
    for (const id of ["git-edit", "git-remove"])
      el<HTMLButtonElement>(id).disabled =
        pending || !selected || !context.native;
    selection.disabled = pending;
    el<HTMLButtonElement>("git-add").disabled = pending;
    input("git-day").disabled = pending;
    form.setBusy(pending);
  }

  async function run(work: () => Promise<void>) {
    if (pending) return;
    if (!context.native) {
      status("Open the Windows app to configure Git repositories.", true);
      return;
    }
    pending = true;
    controls();
    status("");
    try {
      await work();
    } catch (error) {
      status(String(error), true);
    } finally {
      pending = false;
      controls();
    }
  }

  async function refresh() {
    if (!active || !context.native) return;
    if (loading) {
      loadAgain = true;
      return;
    }
    loading = true;
    try {
      do {
        loadAgain = false;
        const repositoryId = selectedId();
        const day = input("git-day").value;
        const requestedLimit = limit;
        const range = day ? localDayRange(day) : { from: null, to: null };
        const result = await getGitSnapshot({
          repositoryId,
          ...range,
          limit: requestedLimit,
        });
        if (
          repositoryId !== selectedId() ||
          day !== input("git-day").value ||
          requestedLimit !== limit
        ) {
          loadAgain = true;
          continue;
        }
        snapshot = result;
        selection.replaceChildren(
          Object.assign(document.createElement("option"), {
            value: "",
            textContent: "All repositories",
          }),
          ...snapshot.repositories.map((repo) =>
            Object.assign(document.createElement("option"), {
              value: String(repo.id),
              textContent: `${repo.name} — ${repo.project}`,
            }),
          ),
        );
        selection.value =
          repositoryId !== null &&
          snapshot.repositories.some((repo) => repo.id === repositoryId)
            ? String(repositoryId)
            : "";
        form.render(snapshot.repositories, projectNames);
        renderGitTimeline(snapshot, limit);
        controls();
      } while (loadAgain && active);
    } catch (error) {
      status(String(error), true);
    } finally {
      loading = false;
    }
  }

  async function performImport() {
    status("Reading local commits…");
    const result = await importCommits(selectedId());
    await refresh();
    status(
      result.failed
        ? `Import finished with ${result.failed} repository error(s). See details below.`
        : `Local import complete: ${result.imported} matching commit(s).`,
      result.failed > 0,
    );
  }

  const form = initRepositoryForm({
    native: context.native,
    run,
    status,
    saved: async (id) => {
      // Add the new selection before loading the refreshed repository list.
      selection.append(
        Object.assign(document.createElement("option"), {
          value: String(id),
          textContent: "Saved repository",
        }),
      );
      selection.value = String(id);
      limit = 100;
      await refresh();
      status("Repository saved.");
      if (!snapshot.busy) await performImport();
      else
        status(
          "Repository saved. Another import is running; refresh after it finishes.",
        );
    },
  });

  el("git-refresh").addEventListener("click", () => void run(performImport));
  el("git-edit").addEventListener("click", () => {
    const repo = snapshot.repositories.find((repo) => repo.id === selectedId());
    if (repo) form.edit(repo);
  });
  el("git-remove").addEventListener(
    "click",
    () =>
      void run(async () => {
        const id = selectedId();
        if (id === null) return;
        await removeRepository(id);
        selection.value = "";
        form.reset();
        await refresh();
        status(
          "Repository removed from Quiet Time. Its Git folder is unchanged.",
        );
      }),
  );
  const filterChanged = () => {
    limit = 100;
    void refresh();
  };
  selection.addEventListener("change", filterChanged);
  input("git-day").addEventListener("change", filterChanged);
  el("git-more").addEventListener("click", () => {
    limit = Math.min(1000, limit + 100);
    void refresh();
  });
  controls();

  return {
    isDialogOpen: form.isOpen,
    focusDialog: form.focus,
    setActive(value) {
      const changed = value !== active;
      active = value;
      if (active && changed) {
        if (context.native) void refresh();
        else status("Git repository setup is available in the Windows app.");
      }
    },
    update(projects) {
      projectNames = projects;
      el("git-mode").textContent = context.getData()?.paused
        ? "Tracking paused · Automatic Git imports paused. Refresh now still reads local history."
        : "Imports local history every minute while tracking is active. No remote requests.";
      form.render(snapshot.repositories, projectNames);
      if (active) void refresh();
    },
    refresh,
  };
}
