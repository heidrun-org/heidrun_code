//! Puts the built mobile website, the folder `../mobile_website/dist`, inside the program. The script copies the
//! folder into `OUT_DIR`, writes a table of every file of the copy, and the file `src/embedded.rs` reads the table.
//! Every path that Cargo records is relative to this package or inside the target folder, so a worktree that clones
//! the target folder of the main checkout does not compile this crate again (issue 864).

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("Cargo sets CARGO_MANIFEST_DIR"));
    let dist = manifest_dir.join("..").join("mobile_website").join("dist");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../mobile_website/dist");

    if !dist.join("index.html").is_file() {
        panic!(
            "The mobile website is not built: the file {} does not exist. Run `pnpm --filter mobile_website build` first.",
            dist.join("index.html").display()
        );
    }
    let dist = fs::canonicalize(&dist).expect("the folder dist of the mobile website exists");

    let mut files = Vec::new();
    collect_files(&dist, &dist, &mut files);
    files.sort();

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("Cargo sets OUT_DIR"));
    let copy = out_dir.join("dist");
    if copy.exists() {
        fs::remove_dir_all(&copy).expect("the old copy of the mobile website can be deleted");
    }

    let mut table = String::from("/// Every file of the mobile website: its path in the folder `dist`, and its bytes.\n");
    table.push_str("pub const EMBEDDED_FILES: &[(&str, &[u8])] = &[\n");
    for (relative_path, absolute_path) in &files {
        let copy_path = copy.join(relative_path);
        fs::create_dir_all(copy_path.parent().expect("a file of the copy has a folder"))
            .expect("a folder of the copy of the mobile website can be created");
        fs::copy(absolute_path, &copy_path).expect("a file of the mobile website can be copied");
        table.push_str(&format!(
            "    ({:?}, include_bytes!(concat!(env!(\"OUT_DIR\"), {:?}))),\n",
            relative_path,
            format!("/dist/{}", relative_path)
        ));
    }
    table.push_str("];\n");

    fs::write(out_dir.join("embedded_files.rs"), table).expect("the table of the embedded files can be written");
}

/// Lists the files of a folder and of its subfolders. A file whose name starts with a dot, such as `.DS_Store`, is
/// left out. The path of a file is relative to the folder `dist`, with `/` between the names.
fn collect_files(dist: &Path, folder: &Path, files: &mut Vec<(String, PathBuf)>) {
    let entries = fs::read_dir(folder).expect("the folder dist of the mobile website can be read");
    for entry in entries {
        let path = entry.expect("an entry of the folder dist can be read").path();
        let name = path.file_name().and_then(|name| name.to_str()).unwrap_or("");
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_files(dist, &path, files);
            continue;
        }
        let relative_path = path
            .strip_prefix(dist)
            .expect("a file of the folder dist has a path inside it")
            .components()
            .map(|part| part.as_os_str().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join("/");
        files.push((relative_path, path));
    }
}
