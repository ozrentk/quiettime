export interface GitRepository {
  id: number;
  path: string;
  name: string;
  project: string;
  importFrom: string;
  since: number;
  authors: string[];
  allAuthors: boolean;
  revision: number;
  lastSync: number | null;
  error: string | null;
}

export interface RepositoryInput {
  id: number | null;
  path: string;
  project: string;
  importFrom: string;
  since: number;
  authors: string[];
  allAuthors: boolean;
}

export interface RepositoryInspection {
  path: string;
  name: string;
  authors: string[];
}

export interface GitCommit {
  repositoryId: number;
  repository: string;
  project: string;
  sha: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  authoredAt: number;
  committedAt: number;
}

export interface GitSnapshot {
  repositories: GitRepository[];
  commits: GitCommit[];
  busy: boolean;
  hasMore: boolean;
}

export interface GitFilter {
  repositoryId: number | null;
  from: number | null;
  to: number | null;
  limit: number;
}
export interface GitSyncResult {
  imported: number;
  failed: number;
}
