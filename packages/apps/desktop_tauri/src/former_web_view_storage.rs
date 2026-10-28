//! Reads the saved state of the web page from the web view storage of the former application identifier.
//!
//! Heidrun Code 0.2.7 and older used the identifier `dev.edefiez.herdrdesk`, and Heidrun Code 0.3.0 and older used the identifier
//! `dev.heidrun-org.heidrun`. The web view keeps `localStorage` in a folder named after the identifier, so a version with a
//! new identifier sees an empty `localStorage` and every option returns to its default value (issue 772). The former folders
//! stay on the disk, and this file reads them: the entries of the most recent identifier win.
//!
//! The program `/usr/bin/sqlite3` of macOS reads the SQLite file: the desktop application may not depend on an SQLite
//! library, because only the packages of the data layer open SQLite files in the desktop application. The program reads a
//! copy of the files, because the web view writes recent changes in the `-wal` file, and a read of the original file would
//! need to write in the folder of the former application.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};

/// The identifiers of installed Heidrun Code before the rename to Heidrun Code (issue 837) and before the issue 702, the most recent
/// first.
const FORMER_IDENTIFIERS: [&str; 2] = ["dev.heidrun-org.heidrun", "dev.edefiez.herdrdesk"];
/// The program of macOS that reads an SQLite file.
const SQLITE3: &str = "/usr/bin/sqlite3";
/// The name of the SQLite file of the `localStorage` of one origin, and of its two companion files.
const DATABASE_NAME: &str = "localstorage.sqlite3";
const COMPANION_SUFFIXES: [&str; 2] = ["-wal", "-shm"];
/// Only the entries of Heidrun Code are read.
const KEY_PREFIX: &str = "heidrun.";

/// Gives every call its own temporary folder, so that two reads at the same time do not mix their copies.
static CALL_COUNTER: AtomicU64 = AtomicU64::new(0);

/// The entries of the `localStorage` of the former installed Heidrun Code, or no entry when there is none or when it cannot be read.
/// Heidrun Code Development never reads the former storage of installed Heidrun Code: the two keep separate preferences.
#[tauri::command]
pub async fn former_web_view_storage_read() -> BTreeMap<String, String> {
    if crate::application_profile::is_development() {
        return BTreeMap::new();
    }
    let Some(home) = dirs::home_dir() else {
        return BTreeMap::new();
    };
    let web_kit_folder = home.join("Library/WebKit");
    let result = tauri::async_runtime::spawn_blocking(move || read_former_entries(&web_kit_folder, &FORMER_IDENTIFIERS)).await;
    match result {
        Ok(Ok(entries)) => entries,
        Ok(Err(error)) => {
            eprintln!("former web view storage: {error}");
            BTreeMap::new()
        }
        Err(error) => {
            eprintln!("former web view storage: {error}");
            BTreeMap::new()
        }
    }
}

/// Reads the entries of the web view folders of several former identifiers. A key that two identifiers hold keeps the value of
/// the first identifier of the list.
fn read_former_entries(web_kit_folder: &Path, identifiers: &[&str]) -> Result<BTreeMap<String, String>, String> {
    let mut entries = BTreeMap::new();
    for identifier in identifiers {
        for (key, value) in read_entries(&web_kit_folder.join(identifier))? {
            entries.entry(key).or_insert(value);
        }
    }
    Ok(entries)
}

/// Reads the entries of every `tauri://localhost` store in the web view folder of one application identifier.
fn read_entries(identifier_folder: &Path) -> Result<BTreeMap<String, String>, String> {
    let mut entries = BTreeMap::new();
    for database in find_databases(identifier_folder) {
        for (key, value) in read_database(&database)? {
            entries.entry(key).or_insert(value);
        }
    }
    Ok(entries)
}

/// The `localstorage.sqlite3` files of the origin `tauri://localhost`. The folder `<hash>/<hash>` of an origin holds the
/// file `origin` with the scheme and the host of the origin, so a store of a development server at `http://localhost` is
/// not read.
fn find_databases(identifier_folder: &Path) -> Vec<PathBuf> {
    let mut databases = Vec::new();
    let Ok(first_level) = std::fs::read_dir(identifier_folder.join("WebsiteData/Default")) else {
        return databases;
    };
    for first in first_level.flatten() {
        let Ok(second_level) = std::fs::read_dir(first.path()) else {
            continue;
        };
        for second in second_level.flatten() {
            let database = second.path().join("LocalStorage").join(DATABASE_NAME);
            let origin = std::fs::read(second.path().join("origin")).unwrap_or_default();
            let is_tauri_origin = origin.windows(5).any(|window| window == b"tauri");
            if is_tauri_origin && database.is_file() {
                databases.push(database);
            }
        }
    }
    databases.sort();
    databases
}

/// Copies one store with its companion files into a temporary folder, reads the entries of Heidrun Code, and deletes the copy.
fn read_database(database: &Path) -> Result<Vec<(String, String)>, String> {
    let copy_folder = std::env::temp_dir().join(format!(
        "heidrun-former-storage-{}-{}",
        std::process::id(),
        CALL_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir_all(&copy_folder).map_err(|error| format!("cannot create {}: {error}", copy_folder.display()))?;
    let result = copy_and_query(database, &copy_folder);
    let _ = std::fs::remove_dir_all(&copy_folder);
    result
}

fn copy_and_query(database: &Path, copy_folder: &Path) -> Result<Vec<(String, String)>, String> {
    let copy = copy_folder.join(DATABASE_NAME);
    std::fs::copy(database, &copy).map_err(|error| format!("cannot copy {}: {error}", database.display()))?;
    for suffix in COMPANION_SUFFIXES {
        let companion = PathBuf::from(format!("{}{suffix}", database.display()));
        if companion.is_file() {
            std::fs::copy(&companion, copy_folder.join(format!("{DATABASE_NAME}{suffix}")))
                .map_err(|error| format!("cannot copy {}: {error}", companion.display()))?;
        }
    }
    let query = format!("select key, typeof(value), hex(value) from ItemTable where key like '{KEY_PREFIX}%';");
    let output = Command::new(SQLITE3)
        .arg("-separator")
        .arg("|")
        .arg(&copy)
        .arg(query)
        .output()
        .map_err(|error| format!("cannot start {SQLITE3}: {error}"))?;
    if output.status.success() == false {
        return Err(format!("{SQLITE3} failed: {}", String::from_utf8_lossy(&output.stderr).trim()));
    }
    let mut entries = Vec::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let mut parts = line.splitn(3, '|');
        let (Some(key), Some(kind), Some(hex)) = (parts.next(), parts.next(), parts.next()) else {
            continue;
        };
        if key.starts_with(KEY_PREFIX) == false {
            continue;
        }
        match decode_value(kind, hex) {
            Some(value) => entries.push((key.to_string(), value)),
            None => eprintln!("former web view storage: the value of {key} cannot be decoded"),
        }
    }
    Ok(entries)
}

/// WebKit saves a `localStorage` value as a blob of UTF-16 little-endian text. A value saved as SQLite text is UTF-8.
fn decode_value(kind: &str, hex: &str) -> Option<String> {
    let bytes = decode_hex(hex)?;
    if kind == "text" {
        return String::from_utf8(bytes).ok();
    }
    if bytes.len() % 2 != 0 {
        return None;
    }
    let units: Vec<u16> = bytes.chunks_exact(2).map(|pair| u16::from_le_bytes([pair[0], pair[1]])).collect();
    String::from_utf16(&units).ok()
}

fn decode_hex(hex: &str) -> Option<Vec<u8>> {
    if hex.len() % 2 != 0 || hex.is_ascii() == false {
        return None;
    }
    (0..hex.len()).step_by(2).map(|index| u8::from_str_radix(&hex[index..index + 2], 16).ok()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encode_hex(bytes: &[u8]) -> String {
        bytes.iter().map(|byte| format!("{byte:02X}")).collect()
    }

    fn utf16_hex(text: &str) -> String {
        let bytes: Vec<u8> = text.encode_utf16().flat_map(|unit| unit.to_le_bytes()).collect();
        encode_hex(&bytes)
    }

    fn test_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("hd-former-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        folder
    }

    /// Builds the folder of a web view store the way WebKit does, with a real SQLite file made by the program of macOS.
    fn build_store(identifier_folder: &Path, origin_text: &[u8], rows: &[(&str, &str, String)]) -> PathBuf {
        let origin_folder = identifier_folder.join("WebsiteData/Default/hashA/hashA");
        let storage_folder = origin_folder.join("LocalStorage");
        std::fs::create_dir_all(&storage_folder).unwrap();
        std::fs::write(origin_folder.join("origin"), origin_text).unwrap();
        let database = storage_folder.join(DATABASE_NAME);
        let mut script = String::from(
            "pragma journal_mode=wal; create table ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB NOT NULL ON CONFLICT FAIL);",
        );
        for (key, kind, hex) in rows {
            let value = if *kind == "text" { format!("cast(x'{hex}' as text)") } else { format!("cast(x'{hex}' as blob)") };
            script.push_str(&format!("insert into ItemTable values ('{key}', {value});"));
        }
        let output = Command::new(SQLITE3).arg(&database).arg(script).output().unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        database
    }

    #[test]
    fn a_utf16_blob_is_decoded_with_accents_quotes_and_characters_above_the_basic_plane() {
        let text = "{\"name\":\"é \\\" 😀\"}";
        assert_eq!(decode_value("blob", &utf16_hex(text)), Some(text.to_string()));
    }

    #[test]
    fn a_text_value_is_decoded_as_utf8() {
        assert_eq!(decode_value("text", &encode_hex("é".as_bytes())), Some("é".to_string()));
    }

    #[test]
    fn a_value_that_cannot_be_decoded_gives_none() {
        assert_eq!(decode_value("blob", "ABC"), None);
        assert_eq!(decode_value("blob", "ZZ"), None);
        assert_eq!(decode_value("blob", "41"), None);
        assert_eq!(decode_value("blob", "00D8"), None);
    }

    #[test]
    fn the_entries_of_heidrun_are_read_and_the_other_entries_are_not() {
        let folder = test_folder("entries");
        build_store(
            &folder,
            b"tauri\0localhost\0",
            &[
                ("heidrun.settings", "blob", utf16_hex("{\"fontSize\":18}")),
                ("heidrun.notes", "blob", utf16_hex("[\"é\"]")),
                ("other.key", "blob", utf16_hex("not read")),
            ],
        );
        let entries = read_entries(&folder).unwrap();
        let expected: BTreeMap<String, String> = [
            ("heidrun.settings".to_string(), "{\"fontSize\":18}".to_string()),
            ("heidrun.notes".to_string(), "[\"é\"]".to_string()),
        ]
        .into_iter()
        .collect();
        assert_eq!(entries, expected);
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn the_original_folder_is_not_changed() {
        let folder = test_folder("no-change");
        let database = build_store(&folder, b"tauri\0localhost\0", &[("heidrun.a", "blob", utf16_hex("1"))]);
        let size_before = std::fs::metadata(&database).unwrap().len();
        let names_before: Vec<_> = std::fs::read_dir(database.parent().unwrap()).unwrap().map(|e| e.unwrap().file_name()).collect();
        read_entries(&folder).unwrap();
        let names_after: Vec<_> = std::fs::read_dir(database.parent().unwrap()).unwrap().map(|e| e.unwrap().file_name()).collect();
        assert_eq!(std::fs::metadata(&database).unwrap().len(), size_before);
        assert_eq!(names_after, names_before);
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn a_store_of_a_development_server_is_not_read() {
        let folder = test_folder("development-server");
        build_store(&folder, b"http\0localhost\0", &[("heidrun.settings", "blob", utf16_hex("{}"))]);
        assert!(read_entries(&folder).unwrap().is_empty());
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn the_most_recent_former_identifier_wins_and_the_older_one_fills_the_gaps() {
        let web_kit_folder = test_folder("identifiers");
        build_store(
            &web_kit_folder.join("dev.heidrun-org.heidrun"),
            b"tauri\0localhost\0",
            &[("heidrun.settings", "blob", utf16_hex("{\"fontSize\":20}"))],
        );
        build_store(
            &web_kit_folder.join("dev.edefiez.herdrdesk"),
            b"tauri\0localhost\0",
            &[("heidrun.settings", "blob", utf16_hex("{\"fontSize\":12}")), ("heidrun.notes", "blob", utf16_hex("[]"))],
        );
        let entries = read_former_entries(&web_kit_folder, &FORMER_IDENTIFIERS).unwrap();
        assert_eq!(entries.get("heidrun.settings"), Some(&"{\"fontSize\":20}".to_string()));
        assert_eq!(entries.get("heidrun.notes"), Some(&"[]".to_string()));
        let _ = std::fs::remove_dir_all(&web_kit_folder);
    }

    #[test]
    fn a_folder_that_does_not_exist_gives_no_entry() {
        let folder = test_folder("missing");
        assert!(read_entries(&folder).unwrap().is_empty());
    }

    /// Reads the real folder of the former installed Heidrun Code. It prints the names and the sizes only, never the values.
    /// Run by hand with its full name: `cargo test live_reads_the_real_former_storage -- --ignored --nocapture`. A shorter
    /// filter such as `live_` also runs the other ignored tests of the application.
    #[test]
    #[ignore]
    fn live_reads_the_real_former_storage() {
        let folder = dirs::home_dir().unwrap().join("Library/WebKit").join(FORMER_IDENTIFIERS[0]);
        let entries = read_entries(&folder).unwrap();
        for (key, value) in &entries {
            println!("{key}: {} characters", value.chars().count());
        }
        let settings = entries.get("heidrun.settings").expect("the former storage holds heidrun.settings");
        let parsed: serde_json::Value = serde_json::from_str(settings).unwrap();
        println!("heidrun.settings is a JSON object with {} options", parsed.as_object().unwrap().len());
    }
}
