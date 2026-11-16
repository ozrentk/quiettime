// SQL is authored separately and embedded into the executable at compile time.
pub const SCHEMA: &str = include_str!("../sql/schema.sql");
pub const GET_SETTING: &str = include_str!("../sql/get_setting.sql");
pub const SET_SETTING: &str = include_str!("../sql/set_setting.sql");
pub const ENTRY_OVERLAPS: &str = include_str!("../sql/entry_overlaps.sql");
pub const INSERT_PROJECT: &str = include_str!("../sql/insert_project.sql");
pub const INSERT_ENTRY: &str = include_str!("../sql/insert_entry.sql");
pub const DELETE_ENTRY: &str = include_str!("../sql/delete_entry.sql");
pub const LIST_ENTRIES: &str = include_str!("../sql/list_entries.sql");
pub const LIST_PROJECTS: &str = include_str!("../sql/list_projects.sql");
pub const GET_PROJECT: &str = include_str!("../sql/get_project.sql");
pub const LIST_ACTIVITY: &str = include_str!("../sql/list_activity.sql");
pub const LATEST_ACTIVITY: &str = include_str!("../sql/latest_activity.sql");
pub const EXTEND_ACTIVITY: &str = include_str!("../sql/extend_activity.sql");
pub const INSERT_ACTIVITY: &str = include_str!("../sql/insert_activity.sql");
#[cfg(test)]
pub const LEGACY_V1: &str = include_str!("../sql/legacy_v1.sql");

pub const RECENT_ENTRIES: &str = include_str!("../sql/recent_entries.sql");
