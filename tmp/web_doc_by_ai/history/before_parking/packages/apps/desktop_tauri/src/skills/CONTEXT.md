# Directory Context: `/packages/apps/desktop_tauri/src/skills`

## Purpose
The backend of the windows Installed skill and Find new skills: it finds, reads, installs, links, and deletes the skills (the folders with a `SKILL.md` file) that the coding agents read. The file `mod.rs` describes the folders of each agent and the cache.

## Key Exports & Entry Points
- `installed.rs`: the commands `skills_list`, `skills_read`, and `skills_delete`.
- `install.rs`: the commands `skills_preview` and `skills_install`.
- `search.rs`: the command `skills_search`, the search on skills.sh.
- `agent_folders.rs`: the command `skills_link_agent`, and the skills folders and the links of each coding agent.
- `github.rs`: the lookup of a skill in a GitHub repository, with the rate limit of GitHub.
- `repository_paths.rs`: pure functions on the paths of the files of a repository.
- `cache.rs`: the cache of the lists of files and of the SKILL.md texts, in memory and on the disk.
- `skill_text.rs`: the frontmatter of a SKILL.md file.
- `types.rs`: the data shapes and the checks on the names that come from outside.
- Command to run the tests of this folder: `cargo test skills`. The tests that call the network run with `cargo test skills_live -- --ignored`.

## Rules
- Only the modules with a Tauri command are `pub(crate)`. The file `lib.rs` registers each command with its full path, for example `skills::installed::skills_list`.
- `repository_paths.rs`, `skill_text.rs`, and `types.rs` do no input or output, and import no other module of this folder except `types.rs`.
- A command name and an error code never change without a matching change in `stores/skills.ts` and in `skillsStore.json` of the frontend.
- Each file keeps its own tests at its end. Helpers shared by several test modules go in `test_support.rs`.
- Heidrun Code never replaces a real folder with a link.

## Background
- The folder comes from the split of the former file `skills.rs`: [issue 129](https://github.com/heidrun-org/heidrun/issues/129).
