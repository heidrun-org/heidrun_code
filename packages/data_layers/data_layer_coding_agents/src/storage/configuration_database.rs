//! The tables of the configuration of the coding agent in the SQLite file: `memory_files`, `subagents`, and `skills`.
//!
//! Each table has the same four columns as the table `chat_sessions`: `repository` (the text `owner/name`), `id` (the
//! absolute path of the file, or of the folder of a skill), `updatedAt`, and `data`. The primary key is `repository` and `id`.
//! The column `id` joins the column `path` of the link table `chat_session_files`, which gives the chat sessions that wrote
//! the file.
//!
//! A row is never deleted: when a read does not find the file of a row any more, the row keeps its facts, and its field
//! `removedAt` and its column `updatedAt` take the date of this read.
//!
//! The mode initialize writes every row that a read found. The mode update writes only the rows that are new, the rows
//! whose column `data` is different, and the rows that are newly marked as removed, so a second update without a change
//! writes no row.

use crate::model::configuration_types::{ConfigurationItem, ConfigurationKind, ConfigurationRead, ConfigurationWriteCount};
use crate::model::schemas::configuration_item_to_checked_value;
use crate::model::types::SynchronizationMode;
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

/// The tables of the configuration of the coding agent in the SQLite file.
pub struct ConfigurationDatabase {
    /// The path of the SQLite file.
    database_path: PathBuf,
    /// The open connection to the SQLite file.
    connection: Connection,
}

impl ConfigurationDatabase {
    /// Opens the SQLite file for reading and writing, and creates the file, its folder, and the three tables when they do
    /// not exist.
    ///
    /// # Errors
    /// An error when the folder or the file cannot be created or opened.
    pub fn open(database_path: &Path) -> Result<Self, String> {
        if let Some(folder) = database_path.parent() {
            std::fs::create_dir_all(folder)
                .map_err(|error| format!("The folder {} cannot be created: {error}", folder.display()))?;
        }
        let connection = Connection::open(database_path)
            .map_err(|error| format!("The database file {} cannot be opened: {error}", database_path.display()))?;
        for kind in ConfigurationKind::ALL {
            connection
                .execute_batch(&create_table_statement(kind))
                .map_err(|error| format!("The table {} cannot be created: {error}", kind.table_name()))?;
        }
        Ok(ConfigurationDatabase { database_path: database_path.to_path_buf(), connection })
    }

    /// The path of the SQLite file.
    pub fn database_path(&self) -> &Path {
        &self.database_path
    }

    /// Writes the items that one read found, and marks as removed, at the date `now`, each row of the same kind whose item
    /// the read did not find. Every item is checked against the JSON schema of its kind before the first row is written, and
    /// the rows of one kind are written in one transaction, so a wrong item writes nothing.
    ///
    /// - The mode initialize writes every item that the read found.
    /// - The mode update writes only the items that have no row, and the items whose column `data` is different from the
    ///   column `data` of their row.
    ///
    /// # Errors
    /// An error when one item does not follow the JSON schema, or when the file cannot be written.
    pub fn write_configuration(
        &mut self,
        mode: SynchronizationMode,
        repository: &str,
        read: &ConfigurationRead,
        now: &str,
    ) -> Result<ConfigurationWriteCount, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "write_configuration", OperationKind::Write)
            .parameter("repository", repository)
            .choice("kind", read.kind.table_name())
            .choice("mode", mode.name())
            .parameter("itemCount", read.items.len())
            .database(&self.database_path);
        record(spec, || self.write_configuration_inside(mode, repository, read, now), |count| {
            Summary::count(count.written_count).detail("removedCount", count.removed_count)
        })
    }

    /// The work of `write_configuration`, between the start event and the completion event of its operation.
    fn write_configuration_inside(
        &mut self,
        mode: SynchronizationMode,
        repository: &str,
        read: &ConfigurationRead,
        now: &str,
    ) -> Result<ConfigurationWriteCount, String> {
        let kind = read.kind;
        let stored = match mode {
            SynchronizationMode::Initialize => HashMap::new(),
            SynchronizationMode::Update => self.find_stored_data(kind, repository)?,
        };
        let mut checked = Vec::with_capacity(read.items.len());
        for item in &read.items {
            let data = configuration_item_to_checked_value(kind, item)?.to_string();
            if stored.get(item.id.as_str()) != Some(&data) {
                checked.push((item, data));
            }
        }
        let found: HashSet<&str> = read.items.iter().map(|item| item.id.as_str()).collect();
        let mut removed = Vec::new();
        for mut item in self.find_present_items(kind, repository)? {
            if found.contains(item.id.as_str()) {
                continue;
            }
            item.removed_at = Some(now.to_string());
            item.updated_at = now.to_string();
            let data = configuration_item_to_checked_value(kind, &item)?.to_string();
            removed.push((item, data));
        }
        let transaction =
            self.connection.transaction().map_err(|error| format!("The transaction cannot start: {error}"))?;
        for (item, data) in checked.iter().map(|(item, data)| (*item, data)).chain(removed.iter().map(|(item, data)| (item, data))) {
            write_row(&transaction, kind, repository, item, data)
                .map_err(|error| format!("The {} {} cannot be written: {error}", kind.description(), item.id))?;
        }
        transaction.commit().map_err(|error| format!("The transaction cannot end: {error}"))?;
        Ok(ConfigurationWriteCount { kind, written_count: checked.len(), removed_count: removed.len() })
    }

    /// Counts the rows of the table of a kind for a repository, with the rows marked as removed.
    pub fn count_rows(&self, kind: ConfigurationKind, repository: &str) -> Result<i64, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "count_configuration_rows", OperationKind::Query)
            .choice("kind", kind.table_name())
            .parameter("repository", repository)
            .database(&self.database_path);
        record(spec, || self.count_rows_inside(kind, repository), |count| Summary::count(*count as usize))
    }

    /// The work of `count_rows`, between the start event and the completion event of its operation.
    fn count_rows_inside(&self, kind: ConfigurationKind, repository: &str) -> Result<i64, String> {
        self.connection
            .query_row(
                &format!("SELECT COUNT(*) FROM {} WHERE repository = ?1", kind.table_name()),
                params![repository],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("The rows cannot be counted: {error}"))
    }

    /// Reads one item. Returns `None` when the table has no such row.
    pub fn find_item(&self, kind: ConfigurationKind, repository: &str, id: &str) -> Result<Option<ConfigurationItem>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "find_configuration_item", OperationKind::Query)
            .choice("kind", kind.table_name())
            .parameter("repository", repository)
            .parameter("id", id)
            .database(&self.database_path);
        record(spec, || self.find_item_inside(kind, repository, id), |found| Summary::count(usize::from(found.is_some())))
    }

    /// The work of `find_item`, between the start event and the completion event of its operation.
    fn find_item_inside(&self, kind: ConfigurationKind, repository: &str, id: &str) -> Result<Option<ConfigurationItem>, String> {
        let data = self
            .connection
            .query_row(
                &format!("SELECT data FROM {} WHERE repository = ?1 AND id = ?2", kind.table_name()),
                params![repository, id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("The row of the {} {id} cannot be read: {error}", kind.description()))?;
        match data {
            None => Ok(None),
            Some(data) => serde_json::from_str(&data)
                .map(Some)
                .map_err(|error| format!("The row of the {} {id} is not a {}: {error}", kind.description(), kind.description())),
        }
    }

    /// Reads the column `data` of every row of a kind for a repository, with the rows marked as removed, by `id`.
    fn find_stored_data(&self, kind: ConfigurationKind, repository: &str) -> Result<HashMap<String, String>, String> {
        let error_of = |error: rusqlite::Error| format!("The rows of the table {} cannot be read: {error}", kind.table_name());
        let mut statement = self
            .connection
            .prepare(&format!("SELECT id, data FROM {} WHERE repository = ?1", kind.table_name()))
            .map_err(error_of)?;
        let rows = statement
            .query_map(params![repository], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map_err(error_of)?
            .collect::<rusqlite::Result<HashMap<String, String>>>()
            .map_err(error_of)?;
        Ok(rows)
    }

    /// Reads the items of a kind for a repository that are not marked as removed.
    fn find_present_items(&self, kind: ConfigurationKind, repository: &str) -> Result<Vec<ConfigurationItem>, String> {
        let error_of = |error: rusqlite::Error| format!("The rows of the table {} cannot be read: {error}", kind.table_name());
        let mut statement = self
            .connection
            .prepare(&format!(
                "SELECT data FROM {} WHERE repository = ?1 AND json_extract(data, '$.removedAt') IS NULL ORDER BY id",
                kind.table_name()
            ))
            .map_err(error_of)?;
        let texts = statement
            .query_map(params![repository], |row| row.get::<_, String>(0))
            .map_err(error_of)?
            .collect::<rusqlite::Result<Vec<String>>>()
            .map_err(error_of)?;
        texts
            .iter()
            .map(|text| {
                serde_json::from_str(text).map_err(|error| format!("A row of the table {} is wrong: {error}", kind.table_name()))
            })
            .collect()
    }
}

/// The statement that creates the table of a kind when it does not exist.
fn create_table_statement(kind: ConfigurationKind) -> String {
    format!(
        "CREATE TABLE IF NOT EXISTS {} (
            repository TEXT NOT NULL,
            id TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            data TEXT NOT NULL CHECK (json_valid(data)),
            PRIMARY KEY (repository, id)
        )",
        kind.table_name()
    )
}

/// Writes the row of one item, or replaces it.
fn write_row(
    transaction: &Transaction,
    kind: ConfigurationKind,
    repository: &str,
    item: &ConfigurationItem,
    data: &str,
) -> rusqlite::Result<usize> {
    transaction.execute(
        &format!(
            "INSERT INTO {} (repository, id, updatedAt, data) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (repository, id) DO UPDATE SET updatedAt = excluded.updatedAt, data = excluded.data",
            kind.table_name()
        ),
        params![repository, item.id, item.updated_at, data],
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{configuration_item, date, temp_folder};

    const REPOSITORY: &str = "heidrun-org/heidrun";

    /// A database in a new temporary folder.
    fn new_database(name: &str) -> ConfigurationDatabase {
        ConfigurationDatabase::open(&temp_folder(name).join("data_layer.sqlite")).unwrap()
    }

    /// A read of skills with the items of these ids.
    fn skills(ids: &[&str]) -> ConfigurationRead {
        ConfigurationRead {
            kind: ConfigurationKind::Skill,
            items: ids.iter().map(|id| configuration_item(ConfigurationKind::Skill, id)).collect(),
        }
    }

    #[test]
    fn creates_the_three_empty_tables() {
        let database = new_database("configuration_creates");
        for kind in ConfigurationKind::ALL {
            assert_eq!(database.count_rows(kind, REPOSITORY), Ok(0), "{}", kind.table_name());
        }
    }

    #[test]
    fn writes_the_items_and_reads_back_the_same_facts() {
        let mut database = new_database("configuration_round_trip");
        let read = ConfigurationRead {
            kind: ConfigurationKind::MemoryFile,
            items: vec![configuration_item(ConfigurationKind::MemoryFile, "/memory/a.md")],
        };
        let count = database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &read, &date(5)).unwrap();
        assert_eq!((count.written_count, count.removed_count), (1, 0));
        assert_eq!(database.find_item(ConfigurationKind::MemoryFile, REPOSITORY, "/memory/a.md"), Ok(Some(read.items[0].clone())));
        assert_eq!(database.find_item(ConfigurationKind::Skill, REPOSITORY, "/memory/a.md"), Ok(None));
    }

    #[test]
    fn marks_a_row_as_removed_once_and_clears_the_mark_when_the_file_comes_back() {
        let mut database = new_database("configuration_removed");
        database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &skills(&["/a", "/b"]), &date(5)).unwrap();
        let count = database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &skills(&["/a"]), &date(6)).unwrap();
        assert_eq!((count.written_count, count.removed_count), (1, 1));
        let removed = database.find_item(ConfigurationKind::Skill, REPOSITORY, "/b").unwrap().unwrap();
        assert_eq!((removed.removed_at, removed.updated_at, removed.created_at), (Some(date(6)), date(6), date(1)));
        let count = database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &skills(&["/a"]), &date(7)).unwrap();
        assert_eq!(count.removed_count, 0);
        let removed = database.find_item(ConfigurationKind::Skill, REPOSITORY, "/b").unwrap().unwrap();
        assert_eq!(removed.removed_at, Some(date(6)));
        database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &skills(&["/a", "/b"]), &date(8)).unwrap();
        let back = database.find_item(ConfigurationKind::Skill, REPOSITORY, "/b").unwrap().unwrap();
        assert_eq!(back.removed_at, None);
        assert_eq!(database.count_rows(ConfigurationKind::Skill, REPOSITORY), Ok(2));
    }

    #[test]
    fn keeps_the_rows_of_another_repository_and_of_another_kind() {
        let mut database = new_database("configuration_other");
        database.write_configuration(SynchronizationMode::Initialize, "other/repository", &skills(&["/a"]), &date(5)).unwrap();
        let subagents = ConfigurationRead { kind: ConfigurationKind::Subagent, items: Vec::new() };
        database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &subagents, &date(6)).unwrap();
        database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &skills(&[]), &date(6)).unwrap();
        let other = database.find_item(ConfigurationKind::Skill, "other/repository", "/a").unwrap().unwrap();
        assert_eq!(other.removed_at, None);
    }

    #[test]
    fn writes_nothing_when_one_item_does_not_follow_its_json_schema() {
        let mut database = new_database("configuration_wrong");
        let mut read = skills(&["/a", "/b"]);
        read.items[1].memory_type = Some("feedback".into());
        assert!(database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &read, &date(5)).unwrap_err().contains("memoryType"));
        assert_eq!(database.count_rows(ConfigurationKind::Skill, REPOSITORY), Ok(0));
    }

    /// A read of skills with the items of these ids, the name of the first item being `name`.
    fn skills_with_first_name(ids: &[&str], name: &str) -> ConfigurationRead {
        let mut read = skills(ids);
        read.items[0].name = name.into();
        read
    }

    #[test]
    fn initialize_writes_every_row_again_and_update_writes_none_when_nothing_changed() {
        let mut database = new_database("configuration_unchanged");
        let first = database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &skills(&["/a", "/b"]), &date(5)).unwrap();
        assert_eq!((first.written_count, first.removed_count), (2, 0));
        let update = database.write_configuration(SynchronizationMode::Update, REPOSITORY, &skills(&["/a", "/b"]), &date(6)).unwrap();
        assert_eq!((update.written_count, update.removed_count), (0, 0));
        let initialize = database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &skills(&["/a", "/b"]), &date(7)).unwrap();
        assert_eq!((initialize.written_count, initialize.removed_count), (2, 0));
    }

    #[test]
    fn update_writes_only_the_new_rows_and_the_rows_whose_data_changed() {
        let mut database = new_database("configuration_changed");
        database.write_configuration(SynchronizationMode::Initialize, REPOSITORY, &skills(&["/a", "/b"]), &date(5)).unwrap();
        let read = skills_with_first_name(&["/a", "/b", "/c"], "another-name");
        let count = database.write_configuration(SynchronizationMode::Update, REPOSITORY, &read, &date(6)).unwrap();
        assert_eq!((count.written_count, count.removed_count), (2, 0));
        assert_eq!(database.find_item(ConfigurationKind::Skill, REPOSITORY, "/a").unwrap().unwrap().name, "another-name");
        assert_eq!(database.count_rows(ConfigurationKind::Skill, REPOSITORY), Ok(3));
        let count = database.write_configuration(SynchronizationMode::Update, REPOSITORY, &read, &date(7)).unwrap();
        assert_eq!((count.written_count, count.removed_count), (0, 0));
    }

    #[test]
    fn update_marks_a_row_as_removed_once_and_writes_the_row_again_when_the_file_comes_back() {
        let mut database = new_database("configuration_update_removed");
        database.write_configuration(SynchronizationMode::Update, REPOSITORY, &skills(&["/a", "/b"]), &date(5)).unwrap();
        let count = database.write_configuration(SynchronizationMode::Update, REPOSITORY, &skills(&["/a"]), &date(6)).unwrap();
        assert_eq!((count.written_count, count.removed_count), (0, 1));
        let count = database.write_configuration(SynchronizationMode::Update, REPOSITORY, &skills(&["/a"]), &date(7)).unwrap();
        assert_eq!((count.written_count, count.removed_count), (0, 0));
        let removed = database.find_item(ConfigurationKind::Skill, REPOSITORY, "/b").unwrap().unwrap();
        assert_eq!((removed.removed_at, removed.updated_at), (Some(date(6)), date(6)));
        let count = database.write_configuration(SynchronizationMode::Update, REPOSITORY, &skills(&["/a", "/b"]), &date(8)).unwrap();
        assert_eq!((count.written_count, count.removed_count), (1, 0));
        assert_eq!(database.find_item(ConfigurationKind::Skill, REPOSITORY, "/b").unwrap().unwrap().removed_at, None);
    }

    #[test]
    fn update_compares_only_with_the_rows_of_its_own_repository() {
        let mut database = new_database("configuration_update_repository");
        database.write_configuration(SynchronizationMode::Initialize, "other/repository", &skills(&["/a"]), &date(5)).unwrap();
        let count = database.write_configuration(SynchronizationMode::Update, REPOSITORY, &skills(&["/a"]), &date(6)).unwrap();
        assert_eq!(count.written_count, 1);
    }
}
