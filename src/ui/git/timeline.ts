import type { GitSnapshot } from "../../git/types";
import { el, textNode } from "../../utils/dom";

const timestamp = (value: number) =>
  new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function renderGitTimeline(data: GitSnapshot, limit: number) {
  const statuses = el("git-repository-statuses");
  statuses.replaceChildren();
  for (const repo of data.repositories) {
    const row = document.createElement("article");
    row.className = "git-repository-status";
    row.append(
      textNode("strong", `${repo.name} → ${repo.project}`),
      textNode("p", repo.path, "muted"),
    );
    row.append(
      textNode(
        "p",
        `From ${repo.importFrom} · ${repo.allAuthors ? "All authors" : repo.authors.join(", ")}`,
        "muted",
      ),
    );
    row.append(
      textNode(
        "p",
        repo.error
          ? `Import error: ${repo.error}`
          : repo.lastSync === null
            ? "Not imported yet"
            : `Last imported ${timestamp(repo.lastSync)}`,
        repo.error ? "git-error" : "muted",
      ),
    );
    statuses.append(row);
  }
  const list = el("git-commits");
  list.replaceChildren();
  el("git-count").textContent =
    `${data.commits.length}${data.hasMore ? "+" : ""} shown${data.busy ? " · Importing…" : ""}`;
  if (!data.commits.length)
    list.append(
      textNode(
        "p",
        data.repositories.length
          ? "No commits match this selection. Check the import date and author emails, then refresh."
          : "Add a local repository to see its commits here.",
        "empty",
      ),
    );
  for (const commit of data.commits) {
    const row = document.createElement("article");
    row.className = "git-commit";
    row.append(
      textNode("strong", commit.subject || "(No commit subject)"),
      textNode("p", `${commit.repository} · ${commit.project}`, "git-project"),
    );
    row.append(
      textNode("p", `${commit.authorName} <${commit.authorEmail}>`, "muted"),
    );
    row.append(
      textNode(
        "small",
        `${timestamp(commit.committedAt)} · ${commit.sha.slice(0, 8)}`,
        "record-time",
      ),
    );
    list.append(row);
  }
  el<HTMLButtonElement>("git-more").hidden = !data.hasMore;
  el<HTMLButtonElement>("git-more").disabled = limit >= 1000;
  el("git-more").textContent =
    limit >= 1000
      ? "Latest 1,000 shown — narrow the date or repository filter"
      : "Show more commits";
}
