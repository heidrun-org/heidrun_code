# Directory Context: `/packages/apps/desktop_tauri/src/skills`

## Purpose
The backend of the windows Installed skill and Find new skills: it finds, reads, installs, links, and deletes the skills (the folders with a `SKILL.md` file) that the coding agents read. It also installs the two skills shipped with Heidrun Code on the first launch of each version. The file `mod.rs` describes the folders of each agent and the cache.

## Key Exports & Entry Points
- `installed.rs`: the commands `skills_list`, `skills_read`, and `skills_delete`.
- `install.rs`: the commands `skills_preview` and `skills_install` (a skill of skills.sh), `skills_preview_folder` and `skills_install_folder` (the web address of a skill folder in a public GitHub or GitLab repository), and `skills_preview_local_folder` and `skills_install_local_folder` (a folder on this computer).
- `search.rs`: the command `skills_search` (skills.sh), and the commands `skills_find_local_folders` and `skills_find_folders`, which give the skill folders at a full path or at a web address: the folder itself when it holds a `SKILL.md` file, otherwise each direct subfolder that holds one.
- `agent_folders.rs`: the command `skills_link_agent`, and the skills folders and the links of each coding agent.
- `bundled.rs`: installs the bundled skills and links the bundled command lines in `~/.local/bin`.
- `github.rs`: the lookup of a skill in a GitHub repository, and of the files below a skill folder, with the rate limit of GitHub.
- `gitlab.rs`: the same for a public GitLab project, with the REST API of `gitlab.com` and its paginated tree.
- `local_folder.rs`: reads and copies a skill folder of this computer, and skips links, the folder `.git`, and files that are too large.
- `folder_address.rs`: reads the web address of a skill folder, on GitHub (`tree/`) or on GitLab (`/-/tree/`): the host, the repository or project, and the parts after `tree/`.
- `repository_paths.rs`: pure functions on the paths of the files of a repository, among them `find_skill_folders`.
- `cache.rs`: the cache of the lists of files and of the SKILL.md texts, in memory and on the disk.
- `skill_text.rs`: the frontmatter of a SKILL.md file.
- `types.rs`: the data shapes and the checks on the names that come from outside.
- Command to run the tests of this folder: `cargo test skills`. The tests that call the network run with `cargo test skills_live -- --ignored`.

## Rules
- Only the modules with a Tauri command are `pub(crate)`. The file `lib.rs` registers each command with its full path, for example `skills::installed::skills_list`.
- `repository_paths.rs`, `folder_address.rs`, `skill_text.rs`, and `types.rs` do no input or output, and import no other module of this folder except `types.rs`.
- A command name and an error code never change without a matching change in `stores/skills.ts` and in `skillsStore.json` of the frontend.
- Each file keeps its own tests at its end. Helpers shared by several test modules go in `test_support.rs`.
- Heidrun Code never replaces a real folder with a link.
- The four installations (skills.sh, a web address, a local folder, and a bundled Heidrun Code skill) share `plan_install`, `prepare_staging`, and `finish_install`, so they give the same folders, links, and origin file. Only the origin of a web address has `folder_url`, and only the origin of a local folder has `folder_path` and an empty `source`.
- A local folder is copied, never linked, and nothing is sent over the network.
- A GitLab test uses the fake server of `test_support.rs`, so no test needs the network.
- The web address does not say where the branch ends, because a branch name can hold slashes: `list_folder_files` (GitHub) and `list_gitlab_folder_files` try the shortest branch first, and the text of `SKILL.md` is read with the whole address.

## Background
- The folder comes from the split of the former file `skills.rs`: [issue 129](https://github.com/heidrun-org/heidrun/issues/129). The installation from a web address comes from [issue 289](https://github.com/heidrun-org/heidrun/issues/289), and the GitLab support and the local folder from [issue 609](https://github.com/heidrun-org/heidrun/issues/609). The folder that holds several skill folders comes from [issue 849](https://github.com/heidrun-org/heidrun_code/issues/849). The tests that call the network cover a branch name with a slash, a folder that does not exist, and a repository that does not exist (GitHub gives the same answer as for a private repository).
