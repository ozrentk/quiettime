use crate::{platform::Sample, sql};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

pub struct Store(pub Connection);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: i64,
    pub project: String,
    pub note: String,
    pub start: i64,
    pub end: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: i64,
    pub app: String,
    pub title: String,
    pub kind: String,
    pub start: i64,
    pub end: i64,
}

impl Store {
    pub fn new(connection: Connection) -> Result<Self, String> {
        connection
            .execute_batch(sql::SCHEMA)
            .map_err(|e| e.to_string())?;
        Ok(Self(connection))
    }

    pub fn setting(&self, key: &str, default: &str) -> Result<String, String> {
        self.0
            .query_row(sql::GET_SETTING, [key], |r| r.get(0))
            .optional()
            .map(|v| v.unwrap_or_else(|| default.into()))
            .map_err(|e| e.to_string())
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        self.0
            .execute(sql::SET_SETTING, params![key, value])
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    pub fn add_entry(
        &self,
        project: &str,
        note: &str,
        start: i64,
        end: i64,
    ) -> Result<i64, String> {
        if project.trim().is_empty() || project.chars().count() > 120 || note.chars().count() > 1000
        {
            return Err(
                "Enter a project (up to 120 characters) and a note up to 1000 characters".into(),
            );
        }
        let duration = end.checked_sub(start).ok_or("Invalid time range")?;
        if start < 0 || duration <= 0 || duration > 8 * 60 * 60 * 1000 || duration % 60_000 != 0 {
            return Err("Duration must be whole minutes, from 1 minute to 8 hours".into());
        }
        let overlaps: bool = self
            .0
            .query_row(sql::ENTRY_OVERLAPS, params![start, end], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if overlaps {
            return Err("That time overlaps an existing entry. Change the end time or remove the previous entry.".into());
        }
        let transaction = self.0.unchecked_transaction().map_err(|e| e.to_string())?;
        transaction
            .execute(sql::INSERT_PROJECT, [project.trim()])
            .map_err(|e| e.to_string())?;
        transaction
            .execute(
                sql::INSERT_ENTRY,
                params![project.trim(), note.trim(), start, end],
            )
            .map_err(|e| e.to_string())?;
        let id = transaction.last_insert_rowid();
        transaction.commit().map_err(|e| e.to_string())?;
        Ok(id)
    }

    pub fn delete_entry(&self, id: i64) -> Result<(), String> {
        self.0
            .execute(sql::DELETE_ENTRY, [id])
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    pub fn entries(&self, from: i64, to: i64) -> Result<Vec<Entry>, String> {
        let mut query = self
            .0
            .prepare(sql::LIST_ENTRIES)
            .map_err(|e| e.to_string())?;
        let rows = query
            .query_map(params![from, to], |r| {
                Ok(Entry {
                    id: r.get(0)?,
                    project: r.get(1)?,
                    note: r.get(2)?,
                    start: r.get(3)?,
                    end: r.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
    }

    pub fn projects(&self) -> Result<Vec<String>, String> {
        let mut query = self
            .0
            .prepare(sql::LIST_PROJECTS)
            .map_err(|e| e.to_string())?;
        let rows = query
            .query_map([], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
    }

    pub fn save_project(&self, name: &str) -> Result<String, String> {
        let name = name.trim();
        if name.is_empty() || name.chars().count() > 120 {
            return Err("Enter a project or task name from 1 to 120 characters".into());
        }
        self.0
            .execute(sql::INSERT_PROJECT, [name])
            .map_err(|e| e.to_string())?;
        self.0
            .query_row(sql::GET_PROJECT, [name], |r| r.get(0))
            .map_err(|e| e.to_string())
    }

    pub fn activity(&self, from: i64, to: i64) -> Result<Vec<Activity>, String> {
        let mut query = self
            .0
            .prepare(sql::LIST_ACTIVITY)
            .map_err(|e| e.to_string())?;
        let rows = query
            .query_map(params![from, to], |r| {
                Ok(Activity {
                    id: r.get(0)?,
                    app: r.get(1)?,
                    title: r.get(2)?,
                    kind: r.get(3)?,
                    start: r.get(4)?,
                    end: r.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
    }

    pub fn record(&self, start: i64, end: i64, sample: &Sample) -> Result<(), String> {
        if sample.kind == "hud" || end <= start || end - start > 10_000 {
            return Ok(());
        }
        let last: Option<(i64, String, String, String, i64)> = self
            .0
            .query_row(sql::LATEST_ACTIVITY, [], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
            })
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some((id, app, title, kind, last_end)) = last {
            if app == sample.app
                && title == sample.title
                && kind == sample.kind
                && last_end == start
            {
                self.0
                    .execute(sql::EXTEND_ACTIVITY, params![end, id])
                    .map_err(|e| e.to_string())?;
                return Ok(());
            }
        }
        self.0
            .execute(
                sql::INSERT_ACTIVITY,
                params![sample.app, sample.title, sample.kind, start, end],
            )
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn store() -> Store {
        Store::new(Connection::open_in_memory().unwrap()).unwrap()
    }

    #[test]
    fn rejects_overlaps_but_allows_adjacent_entries() {
        let db = store();
        db.add_entry("Project", "", 900_000, 1_800_000).unwrap();
        assert!(db.add_entry("Other", "", 0, 1_800_000).is_err());
        db.add_entry("Other", "", 1_800_000, 2_700_000).unwrap();
        assert!(db.add_entry("", "", 0, 900_000).is_err());
        assert!(db.add_entry("Other", "", 0, 10_000).is_err());
    }

    #[test]
    fn custom_durations_and_projects_include_previous_days() {
        let db = store();
        db.add_entry("Earlier project", "", 0, 7 * 60_000).unwrap();
        db.add_entry("Another", "", 86_400_000, 86_400_000 + 23 * 60_000)
            .unwrap();
        db.add_entry(
            "earlier project",
            "",
            86_400_000 + 23 * 60_000,
            86_400_000 + 24 * 60_000,
        )
        .unwrap();
        assert_eq!(db.projects().unwrap().len(), 2);
        assert_eq!(db.entries(86_400_000, 172_800_000).unwrap().len(), 2);
        assert!(db
            .add_entry("Invalid", "", 172_800_000, 172_830_000)
            .is_err());
        assert!(db
            .add_entry("Invalid", "", 172_800_000, 172_800_000 + 481 * 60_000)
            .is_err());
    }

    #[test]
    fn projects_can_be_saved_without_time_entries_and_survive_entry_deletion() {
        let db = store();
        assert_eq!(db.save_project("  New task  ").unwrap(), "New task");
        assert_eq!(db.save_project("new TASK").unwrap(), "New task");
        assert_eq!(db.projects().unwrap(), vec!["New task"]);
        assert!(db.entries(0, 86_400_000).unwrap().is_empty());
        assert!(db.save_project(" ").is_err());
        assert!(db.save_project(&"x".repeat(121)).is_err());
        let id = db.add_entry("New task", "", 0, 60_000).unwrap();
        db.delete_entry(id).unwrap();
        assert_eq!(db.projects().unwrap(), vec!["New task"]);
    }

    #[test]
    fn existing_entries_migrate_to_the_projects_table() {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(sql::LEGACY_V1).unwrap();
        let db = Store::new(connection).unwrap();
        assert_eq!(db.projects().unwrap(), vec!["Existing project"]);
        assert_eq!(db.entries(0, 86_400_000).unwrap().len(), 1);
    }

    #[test]
    fn merges_contiguous_samples_and_skips_sleep_and_hud() {
        let db = store();
        let sample = Sample {
            app: "editor.exe".into(),
            title: "Work".into(),
            kind: "active".into(),
        };
        db.record(0, 5_000, &sample).unwrap();
        db.record(5_000, 10_000, &sample).unwrap();
        db.record(10_000, 90_000, &sample).unwrap();
        db.record(
            90_000,
            95_000,
            &Sample {
                kind: "hud".into(),
                ..sample.clone()
            },
        )
        .unwrap();
        db.record(95_000, 100_000, &sample).unwrap();
        let rows = db.activity(0, 200_000).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[1].end, 10_000);
        assert_eq!(db.activity(2_000, 7_000).unwrap()[0].end, 7_000);
    }
}
