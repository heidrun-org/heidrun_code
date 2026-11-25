# Directory Context: `/packages/auxiliary/heidrun_code_ctrl/src/skills`

## Purpose
Share the skill search, installation, comparison, and removal operations between Heidrun Code Control and the desktop application.

## Key Exports & Entry Points
- `heidrun_code_ctrl::skills` provides the operations used by both applications.
- `updates::SkillInstallation` lists installed copies, checks them against their recorded sources, and updates them in place.
- Command to test this folder: `cargo test --package heidrun_code_ctrl skills`

## Rules
- The shared operations do not depend on Tauri.
- Comparison and update use the same source files, including files added or removed since installation.
- An update replaces the installed folder only after staging the complete source and keeps the existing coding agent links.
- A local source is copied from disk. A remote source uses the existing public GitHub or GitLab folder lookup.
- Comparisons and updates stage every remote file from one immutable revision. Read-only comparisons may reuse a pinned GitHub repository tree for 30 seconds. Both pause GitHub requests only when GitHub reports a rate limit.
- Successful source comparisons save the complete source file list and content hashes to disk. If a read-only comparison cannot read the source, it compares the installed files with that saved record and marks the result as stale.
- Workspace updates and removals check the resolved skill location against the selected workspace. Removal requires a valid installed skill.
- The network tests are ignored by default.

## Background
- Command-line skill management follows [issue #1097](https://github.com/heidrun-org/heidrun_code/issues/1097).
