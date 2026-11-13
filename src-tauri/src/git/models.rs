use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Repository {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub project: String,
    pub import_from: String,
    pub since: i64,
    pub authors: Vec<String>,
    pub all_authors: bool,
    pub revision: i64,
    pub last_sync: Option<i64>,
    pub error: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepositoryInput {
    pub id: Option<i64>,
    pub path: String,
    pub project: String,
    pub import_from: String,
    pub since: i64,
    pub authors: Vec<String>,
    pub all_authors: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Inspection {
    pub path: String,
    pub name: String,
    pub authors: Vec<String>,
}

#[derive(Clone, Debug)]
pub(crate) struct Commit {
    pub sha: String,
    pub subject: String,
    pub author_name: String,
    pub author_email: String,
    pub authored_at: i64,
    pub committed_at: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TimelineCommit {
    pub repository_id: i64,
    pub repository: String,
    pub project: String,
    pub sha: String,
    pub subject: String,
    pub author_name: String,
    pub author_email: String,
    pub authored_at: i64,
    pub committed_at: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Snapshot {
    pub repositories: Vec<Repository>,
    pub commits: Vec<TimelineCommit>,
    pub busy: bool,
    pub has_more: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SyncResult {
    pub imported: usize,
    pub failed: usize,
}
