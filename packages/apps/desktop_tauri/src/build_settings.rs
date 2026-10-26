//! The Cargo settings that keep the development build fast to compile. A development build needs a fast compilation,
//! not a fast executable (issue 915).

#[cfg(test)]
mod tests {
    use std::path::Path;

    /// The text of a Cargo manifest, at a path relative to the folder of this package.
    fn read_manifest(relative_path: &str) -> String {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(relative_path);
        std::fs::read_to_string(&path).unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()))
    }

    /// The text of the section `[name]` of a manifest, without its heading, up to the next section.
    fn section(manifest: &str, name: &str) -> String {
        let heading = format!("[{name}]");
        let mut lines = manifest.lines().skip_while(|line| line.trim() != heading);
        assert!(lines.next().is_some(), "the manifest has no section {heading}");
        lines.take_while(|line| line.trim_start().starts_with('[') == false).collect::<Vec<_>>().join("\n")
    }

    #[test]
    fn the_application_library_builds_only_the_rlib_kind() {
        let library = section(&read_manifest("Cargo.toml"), "lib");
        assert!(library.contains(r#"crate-type = ["rlib"]"#), "the section [lib] must build only rlib:\n{library}");
    }

    #[test]
    fn the_development_build_writes_only_the_line_tables_of_the_workspace_and_no_debug_information_for_the_dependencies() {
        let manifest = read_manifest("../../../Cargo.toml");
        let workspace = section(&manifest, "profile.dev");
        assert!(workspace.contains(r#"debug = "line-tables-only""#), "the section [profile.dev]:\n{workspace}");
        let dependencies = section(&manifest, r#"profile.dev.package."*""#);
        assert!(dependencies.contains("debug = false"), r#"the section [profile.dev.package."*"]:\n{dependencies}"#);
    }
}
