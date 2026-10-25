# Directory Context: `/packages/apps/web_frontend/src/components/skills`

## Purpose
The parts of the two skills windows: the frame, the level switch, the source switch, the notice, the list of installed skills, and the three fields to find a skill. The windows `../InstalledSkillModal.vue` and `../FindNewSkillsModal.vue` put them together.

## Key Exports & Entry Points
- `../InstalledSkillModal.vue`: the window Installed skill. It lists the installed skills, and each one can be inspected or deleted. It has no level switch and no search.
- `../FindNewSkillsModal.vue`: the window Find new skills. It has four lines, each with a circled question mark that opens an information card: Installation level (User first, then Workspace), Source of the skill (skills.sh, Local folder, Code hosting), the field of the chosen source, and Result. Each result can be inspected or installed. A skill is installed for the agents switched on in the section Agents of the Settings window. The level and the source are saved in the settings.
- `../SkillFileModal.vue`: the window opened by the button "Inspect". It shows a SKILL.md file rendered, as highlighted source, or as the differences from the installed skill, and it sits above the two skills windows. Both skills windows open from the menu with three vertical dots of the top bar (`../MoreMenu.vue`) and from the command palette.
- `SkillsLevelSwitch.vue`: the line Installation level: the choice between the workspace level and the user level, a Bootstrap button group of two radio inputs, drawn like the choice of the language in the Settings window ([issue 490](https://github.com/heidrun-org/heidrun/issues/490)).
- `SkillsSourceSwitch.vue`: the line Source of the skill: a Bootstrap button group of three radio inputs. A change calls `setSkillSource`, which shows the result of the field of that source.
- `SkillsHelpCard.vue`: the circled question mark of a line and its information card (an `InformationCard.vue` with placement "bottom"). `skills_help.ts` lists the blocks of each card. The texts are in `settingsSkills.json` under `help_<topic>_*`.
- `SkillsNoAgentNotice.vue`: the notice with the button "Open Agents", shown when no coding agent is switched on.
- `SkillsWindow.vue`: the frame of both skills windows: the title, the question mark with the help text, the close button, the Escape key, and the loading of the skills. A skills window gives it a title, a help text, and its content in the slot.
- `InstalledSkillsList.vue`: the list of installed skills, one `InstalledSkillRow.vue` for each skill (inspect, add link, delete).
- `FindSkills.vue`: the source switch, the field of the chosen source, and the line Result with one `SkillSearchResultRow.vue` for each result (inspect, install or replace, a card with the description; "Different" when its SKILL.md differs: `../../lib/skill_difference.ts`).
- `FindSkillsSearchInput.vue`, `FindSkillsLocalFolder.vue`, `FindSkillsCodeHosting.vue`: the field of each source. skills.sh searches 300 milliseconds after the last key. Local folder takes a full path or the folder chooser, checked 300 milliseconds after the last key. Code hosting takes a web address on GitHub or GitLab (`../../lib/skill_folder_address.ts`), checked 500 milliseconds after the last key. Both give one row for each skill found in the folder.
- `skills_section.css`: the styles of the lists and rows, shared by both row components.
- `skills_test_support.ts`: the fake backend and the helpers shared by the tests of this folder.

## Rules
- A component here reads and changes the state through `../../stores/skills.ts` and `../../stores/settings.ts`, and never calls `invoke` itself.
- The shared styles in `skills_section.css` start with `.skillsSection`, so they apply only inside a skills window.
- Each component has its own test file next to it. A test mounts only the component under test.
- Every line of the window Find new skills has a circled question mark with an information card, and every input has a visible label. `FindNewSkillsModal.test.ts` tests both.
- A result of the search carries its place: `folderPath` for a local folder, `folderUrl` and `host` for a web address, neither for skills.sh. `resultOrigin` in the store reads it, and the row, the file view, and the installation follow it.

## Background
- The folder comes from the split of the section Skills of the Settings window: [issue 131](https://github.com/heidrun-org/heidrun/issues/131). The skills left the Settings window and became two windows: [issue 138](https://github.com/heidrun-org/heidrun/issues/138).
- The window Find new skills installs a skill with the command `skills_install` of `desktop_tauri/src/skills/install.rs` (skills.sh), `skills_install_folder` (a web address on GitHub or GitLab, [issue 289](https://github.com/heidrun-org/heidrun/issues/289)), or `skills_install_local_folder` (a folder on this computer). The three sources and the information cards come from [issue 609](https://github.com/heidrun-org/heidrun/issues/609), and the layout of the cards from [issue 608](https://github.com/heidrun-org/heidrun/issues/608). The search uses the endpoint `https://skills.sh/api/search`, because the documented API `/api/v1` needs a Vercel OIDC token that a desktop application cannot have: [issue 34](https://github.com/heidrun-org/heidrun/issues/34).
