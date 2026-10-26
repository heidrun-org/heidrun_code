# User interface of Heidrun Code: Find new skills window

- Created: 16 October 2026
- Last updated: 25 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: coding agent configuration](../../glossary/coding_agent_configuration.md), [GitHub and GitLab support](../../github_and_gitlab_support.md)
- Related issue: [issue 289](https://github.com/heidrun-org/heidrun/issues/289), [issue 608](https://github.com/heidrun-org/heidrun/issues/608), [issue 609](https://github.com/heidrun-org/heidrun/issues/609), [issue 646](https://github.com/heidrun-org/heidrun/issues/646), [issue 849](https://github.com/heidrun-org/heidrun_code/issues/849)

This file gives the rules of the window "Find new skills", which the item "Find new skills" of the More menu opens. The code of the window is in `packages/apps/web_frontend/src/components/skills`, and its backend is in `packages/apps/desktop_tauri/src/skills`.

## The four lines

The window has four lines, from the top to the bottom. Each line has a title, a circled question mark that opens an information card, and a visible label on each input.

1. "Installation level": the buttons "User" and "Workspace". The level is saved in the settings.
2. "Source of the skill": the buttons "skills.sh", "Local folder", and "Code hosting". The source is not saved: the window starts on "skills.sh".
3. The field of the chosen source, and only that field:
   - "skills.sh": a search field. The search starts 300 milliseconds after the last key typed.
   - "Local folder": a text field for the full path of a folder, and the button "Choose folder…" that opens the folder chooser of the system. The folder is one skill (it holds a file `SKILL.md`), or it holds several skill folders. The folder is checked 300 milliseconds after the last key typed, and at once when the chooser gives a folder.
   - "Code hosting": a text field for the web address of a folder on GitHub or GitLab: one skill folder, or a folder that holds several skill folders. The address is checked 500 milliseconds after the last key typed, because the check asks GitHub or GitLab for the list of the files below the folder. A text that is not an address gives an error with no call.
4. "Result": the rows of the result, each with the buttons "Inspect" and "Install". Before the first answer, the line says "No result yet."

## The information cards

- Each card uses the layout of [issue 608](https://github.com/heidrun-org/heidrun/issues/608): a title, then one block for each paragraph, with the placement "bottom-center".
- The texts of a card are in the files `settingsSkills.json` (English and French), under the keys `help_<line>_title`, `help_<line>_label`, `help_<line>_<block>_title`, and `help_<line>_<block>_text`. The blocks of each card are listed in `skills_help.ts`.
- The key Escape closes an open card first, and the window only at the second key.
- A new line of the window gets a circled question mark with a card, and a new input gets a visible label. The test `FindNewSkillsModal.test.ts` checks both.

## The sources

- A source keeps its own text, and a change of source shows the result of the field of the new source again.
- An answer that comes after the developer changed the text or the source never replaces the newest result.
- "skills.sh": the result rows show the number of installs. A web address typed here is only a search.
- A folder that holds skills: when the folder holds a file `SKILL.md`, it is one skill, and its subfolders are not read. Otherwise each direct subfolder that holds a file `SKILL.md` is one skill, and deeper folders are not read. The Result has one row for each skill, sorted by name, each with the buttons "Inspect" and "Install", and a folder that is one skill gives one row. The rule is `find_skill_folders` in `repository_paths.rs` for a web address, and `find_local_skills` in `local_folder.rs` for a local folder.
- "Local folder": each row has the full path of the skill folder and the words "Local folder". The skill folder is copied to the installation level, and nothing is sent over the network. A folder with no file `SKILL.md` in it or in its direct subfolders gives an error and no row. A link and a hidden folder are skipped.
- "Code hosting": each row has the words "GitHub folder" or "GitLab folder". A text that is not the web address of a folder gives an error and no row, and so does a folder with no file `SKILL.md` in it or in its direct subfolders. A folder with too many files to read (GitLab gives at most 1000 files) gives an error. Every support for GitHub is also a support for GitLab, as [github_and_gitlab_support.md](../../github_and_gitlab_support.md) requires. Only a public repository works.

## The comparison with an installed skill

- A result with the same folder name as a skill installed at the chosen level is compared with that skill. The comparison reads only the two `SKILL.md` files, never the other files of the skill, and it ignores the line ends of Windows and the empty lines at the end.
- When the two files differ, the row shows a small badge "Different" in the warning colors at the left of the buttons, the button "Install" replaces the disabled button "Installed", and the button "Inspect" opens the window of the file on the view "Differences". A line with − is only in the installed skill, and a line with + is only in the result. The developer can go to "Rendered" or "Source" and back. When the files are the same, the view "Differences" says so. A file that cannot be read gives no "Different".
- The button "Install" of a different skill replaces the installed skill: after a confirmation, the installed skill moves to the Trash (as the window Installed skill does), then the result is installed. When the installation fails after the removal, the message says that the previous version is in the Trash.
- The rules are in `skill_difference.ts` and in the functions `compareWithInstalled`, `inspectResult`, and `installSkill` of `stores/skills.ts`.

## The rows of the Result

- A row has the name of the skill and a circled question mark on the first line, then the place of the skill on the second line. The small badge "Different" (when it applies) stands at the left of the buttons, at their height.
- A place that is too long for the row scrolls from the right to the left, to its end, while the pointer is over the row. The scroll starts 0.4 second after the pointer enters, takes 12 milliseconds for each pixel, and goes back to the start when the pointer leaves. The move is a CSS transition of `transform`, so it is smooth, below one pixel. A place that fits does not move.
- A click on the circled question mark opens a card (the component `InformationCard.vue`, as every other circled question mark of the window). The pointer over it opens nothing. The card has the name and the description from the `SKILL.md` file, the place of the skill, and, for an installed skill, the state. The `SKILL.md` file is read at the click, and the card opens when the file is read.
- The buttons are one button group of fixed width, cut in two equal halves, so the separator is at the same place in every row: "Inspect", then "Install", or the disabled "Installed" when the installed skill has the same `SKILL.md` file.
- The two skills windows are 900 pixels wide and 760 pixels high at most.

## The installed skills

- An installed skill from a local folder shows "Local folder · <full path>" as its origin. An installed skill from GitLab shows "GitLab · <project>".
- The origin file `.heidrun_origin.json` of a local folder has an empty `source` and a `folder_path`.
