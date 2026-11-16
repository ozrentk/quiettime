use super::{
    models::{Commit, Inspection, Repository, RepositoryInput, TimelineCommit},
    sql,
};
use crate::store::Store;
use rusqlite::{params, OptionalExtension};

impl Store {
    pub(crate) fn git_repositories(&self) -> Result<Vec<Repository>, String> {
        let mut query = self
            .0
            .prepare(sql::REPOSITORIES)
            .map_err(|e| e.to_string())?;
        let rows = query
            .query_map([], |row| {
                let authors: String = row.get(6)?;
                let authors = serde_json::from_str(&authors).map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        6,
                        rusqlite::types::Type::Text,
                        Box::new(e),
                    )
                })?;
                Ok(Repository {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    project: row.get(3)?,
                    import_from: row.get(4)?,
                    since: row.get(5)?,
                    authors,
                    all_authors: row.get(7)?,
                    revision: row.get(8)?,
                    last_sync: row.get(9)?,
                    error: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
    }

    pub(crate) fn git_save_repository(
        &self,
        input: &RepositoryInput,
        inspection: &Inspection,
    ) -> Result<i64, String> {
        let project_name = input.project.trim();
        if project_name.is_empty() || project_name.chars().count() > 120 {
            return Err("Enter a project or task name from 1 to 120 characters".into());
        }
        let transaction = self.0.unchecked_transaction().map_err(|e| e.to_string())?;
        // Create the project in the same transaction: failed repository saves leave no orphan name.
        transaction
            .execute(crate::sql::INSERT_PROJECT, [project_name])
            .map_err(|e| e.to_string())?;
        let project: i64 = transaction
            .query_row(sql::PROJECT_ID, [project_name], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        let authors = serde_json::to_string(&input.authors).map_err(|e| e.to_string())?;
        let id = if let Some(id) = input.id {
            let changed = transaction
                .execute(
                    sql::UPDATE_REPOSITORY,
                    params![
                        id,
                        inspection.path,
                        inspection.name,
                        project,
                        input.import_from,
                        input.since,
                        authors,
                        input.all_authors
                    ],
                )
                .map_err(|e| e.to_string())?;
            if changed != 1 {
                return Err("Repository no longer exists".into());
            }
            transaction
                .execute(sql::CLEAR_COMMITS, [id])
                .map_err(|e| e.to_string())?;
            id
        } else {
            transaction
                .execute(
                    sql::INSERT_REPOSITORY,
                    params![
                        inspection.path,
                        inspection.name,
                        project,
                        input.import_from,
                        input.since,
                        authors,
                        input.all_authors
                    ],
                )
                .map_err(|e| {
                    format!("Could not save repository (the folder may already be added): {e}")
                })?;
            transaction.last_insert_rowid()
        };
        transaction.commit().map_err(|e| e.to_string())?;
        Ok(id)
    }

    pub(crate) fn git_delete_repository(&self, id: i64) -> Result<(), String> {
        self.0
            .execute(sql::DELETE_REPOSITORY, [id])
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    pub(crate) fn git_store_import(
        &self,
        repo: &Repository,
        commits: &[Commit],
        synced_at: i64,
    ) -> Result<bool, String> {
        let transaction = self.0.unchecked_transaction().map_err(|e| e.to_string())?;
        let revision: Option<i64> = transaction
            .query_row(sql::REVISION, [repo.id], |row| row.get(0))
            .optional()
            .map_err(|e| e.to_string())?;
        if revision != Some(repo.revision) {
            return Ok(false);
        }
        transaction
            .execute(sql::CLEAR_COMMITS, [repo.id])
            .map_err(|e| e.to_string())?;
        {
            let mut insert = transaction
                .prepare(sql::INSERT_COMMIT)
                .map_err(|e| e.to_string())?;
            for commit in commits {
                insert
                    .execute(params![
                        repo.id,
                        commit.sha,
                        commit.subject,
                        commit.author_name,
                        commit.author_email,
                        commit.authored_at,
                        commit.committed_at
                    ])
                    .map_err(|e| e.to_string())?;
            }
        }
        transaction
            .execute(sql::SYNC_RESULT, params![repo.id, repo.revision, synced_at])
            .map_err(|e| e.to_string())?;
        transaction.commit().map_err(|e| e.to_string())?;
        Ok(true)
    }

    pub(crate) fn git_import_error(&self, repo: &Repository, error: &str) -> Result<(), String> {
        self.0
            .execute(sql::SYNC_ERROR, params![repo.id, repo.revision, error])
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    pub(crate) fn git_timeline(
        &self,
        repository_id: Option<i64>,
        from: Option<i64>,
        to: Option<i64>,
        limit: u32,
    ) -> Result<(Vec<TimelineCommit>, bool), String> {
        let mut commits = self.query_git_timeline(repository_id, from, to, i64::from(limit) + 1)?;
        let has_more = commits.len() > limit as usize;
        commits.truncate(limit as usize);
        Ok((commits, has_more))
    }
    pub(crate) fn git_history(&self, from: i64, to: i64) -> Result<Vec<TimelineCommit>, String> {
        // SQLite LIMIT -1 returns the complete bounded week, independent of preview counts.
        self.query_git_timeline(None, Some(from), Some(to), -1)
    }

    fn query_git_timeline(
        &self,
        repository_id: Option<i64>,
        from: Option<i64>,
        to: Option<i64>,
        limit: i64,
    ) -> Result<Vec<TimelineCommit>, String> {
        let mut query = self.0.prepare(sql::TIMELINE).map_err(|e| e.to_string())?;
        let rows = query
            .query_map(params![repository_id, from, to, limit], |row| {
                Ok(TimelineCommit {
                    repository_id: row.get(0)?,
                    repository: row.get(1)?,
                    project: row.get(2)?,
                    sha: row.get(3)?,
                    subject: row.get(4)?,
                    author_name: row.get(5)?,
                    author_email: row.get(6)?,
                    authored_at: row.get(7)?,
                    committed_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let commits = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(commits)
    }
}
