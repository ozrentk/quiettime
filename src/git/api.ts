import { invoke } from "@tauri-apps/api/core";
import type {
  GitFilter,
  GitSnapshot,
  GitSyncResult,
  RepositoryInput,
  RepositoryInspection,
} from "./types";

export const getGitSnapshot = (filter: GitFilter) =>
  invoke<GitSnapshot>("git_snapshot", { ...filter });
export const inspectRepository = (path: string) =>
  invoke<RepositoryInspection>("git_inspect", { path });
export const pickRepositoryFolder = () =>
  invoke<string | null>("git_pick_folder");
export const saveRepository = (input: RepositoryInput) =>
  invoke<number>("git_save_repository", { input });
export const removeRepository = (id: number) =>
  invoke<void>("git_remove_repository", { id });
export const importCommits = (repositoryId: number | null) =>
  invoke<GitSyncResult>("git_refresh", { repositoryId });
