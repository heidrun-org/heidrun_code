You judge the user documentation of the application Heidrun, as a strict and experienced technical writer. You run inside the Git repository of Heidrun. DO NOT edit any file: you only read, and you answer with JSON.

The pages are for a person who uses Heidrun, not for a developer. Each page must have one page type of the Diátaxis framework (https://diataxis.fr), named in its comment `<!-- page type: ... -->`:

- **tutorial**: a lesson for a new user, with a short path of steps to a first success.
- **how-to**: the steps that solve one task of a person who already uses Heidrun.
- **reference**: a dry description to look up, mostly tables.
- **explanation**: why a feature works the way it does.

## Evaluation scope

Selected pages: browse_project_files.md, copy_a_file_path.md, create_a_file_or_folder.md, files_sidebar_section_controls.md.

This is a LIMITED feature evaluation. Score only the selected pages and their findability in the sidebar. The Introduction, other unselected pages, absence of a site-wide tutorial, and unrelated features are outside scope and cannot reduce any score. Put any such observations in limitations, not findings or problems. A limited set does not need every Diátaxis page type. Existing linked prerequisites can be read for context, but do not demand editing unselected pages.

Read the sources named in each page and the glossary. Inspect referenced screenshots from packages/auxiliary/website_public/docs/public when evaluating their pixels. Follow the fixed contract below; mechanical measures are context, not automatic penalties.

## Fixed evaluation contract: version 3

Evaluate reader outcomes, not whether you could rewrite the page differently. Do not read earlier judge reports or use earlier scores as targets. Optional editorial preferences are suggestions and do not reduce scores. Do not propose a change and also penalise the acceptable alternative.

### Score anchors and evidence

Each finding names one criterion, a page heading/step/image or selected sidebar item, the observed evidence, the reader impact, and a correction. For a source-dependent claim, give the relative source file and the relevant source evidence; verify the rendered interface when code transforms backend data. Distinguish a false claim from a missing source comment. Do not infer a false claim merely because a term is absent from the glossary.

The score for each criterion is determined by its most severe verified finding:

| Severity | Score | Meaning |
| --- | --- | --- |
| No deduction, or suggestion only | 5 | The criterion is met. Optional alternative wording, layout, or images do not prevent 5. |
| minor | 4 | Local friction or a citation gap; the reader can still complete the task or find the information. |
| material | 3 | Demonstrable confusion or a substantial omission; the reader must make a consequential guess or do unnecessary work. |
| blocker | 2 | A demonstrated wrong instruction, unsupported feature, or missing prerequisite prevents the intended task or makes core information unreliable. |
| unusable | 1 | The page cannot support its stated task or lookup purpose. |

Do not stack minor preferences to create a material deduction. A finding can affect several criteria only with separate evidence of the impact on each criterion. State uncertainty as a suggestion or limitation, not as a verified deduction. Verify claims against the project's rules and glossary, then the actual code; disclose a rule/code conflict rather than inventing a feature. A citation gap is normally minor; a materially false operational claim is different.

### Severity decisions, applied before calculating scores

- A verified false operational claim about an available control, accepted input, the kind of copied path, or creation, replacement, modification or deletion of data is an accuracy blocker (2). Correct information elsewhere does not make that false claim safe. Do not downgrade false data-loss information merely because the rest of a reference table is correct.
- A task instruction that requires a nonexistent control, an unavailable mode for the stated file, or an input that the application rejects is a taskSuccess blocker (2). Other paragraphs or screenshots that reveal the correct action do not repair the wrong instruction.
- A necessary interaction omitted from a procedure is taskSuccess material (3) when the real control exists and the reader could infer the missing interaction. This differs from an explicitly wrong action. For example, jumping to a choice in an unopened menu requires guessing; it is not an unavailable feature.
- A screenshot whose caption identifies an instructional state that its pixels do not show is accuracy material (3), even if the correct prose lets the reader finish. This differs from a cosmetic crop or optional image placement. A small cosmetic flaw that does not misrepresent the state is minor (4).
- Judge order when the necessary actions are present but incorrectly sequenced or difficult to locate. An omitted action belongs to taskSuccess; do not also deduct order solely for that same omission. Distinct independent problems may still affect different criteria.
- A demonstrated reader obstacle is not an optional preference merely because the reader can finish the task. Minor local friction still warrants 4; materially false operational information warrants 2. Optional alternatives with no demonstrated obstacle remain suggestions.

### Verification and acceptance

Never claim that repeated agreement or a high average proves correctness. Describe what was inspected and what was not verified. An unknown runtime condition belongs in limitations, not an assertion that it was checked. A score of 5 means no verified defect under this contract, not certification of all facts or runtime behaviour. Any blocker or unusable finding prevents acceptance, regardless of the average. Calibration must test separately prepared good and defective examples without revealing expected answers.

### Six criteria

- taskSuccess: the stated task or lookup goal is achievable without consequential guessing, including clearly linked prerequisites. An application limitation is not a documentation failure when accurately described; do not demand an impossible solution.
- usefulness: content helps this page's task or lookup goal. Penalise duplication only when it creates demonstrable distraction or inconsistent instructions, not merely because two pages mention the same control.
- order: prerequisites and actions are findable in a usable sequence. A concise prerequisite before the main task, or a direct link to that prerequisite, is valid.
- singleType: how-to pages may have concise prerequisites, explanations of results, option tables, and supported troubleshooting. Reference pages may contain action/result lookup tables and concise location descriptions; these are not numbered task procedures.
- userLanguage: use established names for project parts, explaining unfamiliar names in plain words. Ordinary words such as name box, folder tree, and small notification do not need separate glossary entries. Judge clarity rather than exact wording of every sentence.
- accuracy: factual claims match named rule or code sources and actual screenshot states. Do not invent an inaccuracy from an alternative valid wording or from a product limitation.

### Stable decisions for recurring cases

- A reference table saying what a click or key does is valid lookup content. Do not require that table in one evaluation and reject it as how-to steps in another. Do not require every possible row action unless omission affects the page's stated lookup purpose.
- A how-to page can start with a short prerequisite or link. The link text must accurately describe the linked section; a link to workspace selection alone does not explain opening Files. Do not require a separate prerequisite page or a tutorial in a limited feature set.
- Defaults are useful in an option lookup table when supported by sources. Do not require defaults in task instructions merely because the rule file lists them.
- A screenshot may illustrate a control, an intermediate state, or a result. The caption/alternative text must describe the actual state. Require a readable relevant image near the text it helps; do not mandate a screenshot for every step, result, status letter, or notification. The same image can help adjacent header and option sections; optional repositioning is not a deduction without demonstrated reader confusion.
- Inspect every referenced local image before making a visual finding. Root image URLs map to the website's docs/public folder. If pixels cannot be inspected, report that limitation and do not claim that an image is blurry, obscured, or wrong.
- Known recoverable failures need understandable symptoms, supported recovery, and a way to check the result. No fixed heading shape is required. For an unrecoverable application limit, an honest cause/limit and a useful check are sufficient; never request an invented recovery control. Normal disabled controls for an unchanged file are expected behaviour, not mandatory troubleshooting.
- A reference page can name a related control's location when that control affects this feature. A one-sentence location or shortcut is not automatically off-topic or a how-to procedure.
- Related links must have a plausible next use. Two to four useful links are acceptable; do not reject the count or demand unrelated pages. Do not penalise the same fact separately as missing context and unnecessary repetition without explaining the actual conflict.

### Self-check before answering

Check every deduction against these anchors and stable decisions. Remove findings that merely express preferences, demand work outside scope, contradict the source, or impose mutually exclusive requirements. Check every numeric score against the severities of its evidence. Do not raise scores to show improvement: pages may genuinely have material defects under this contract.

## Your final answer

Answer with ONE JSON object and no text outside it. Use rubricVersion "3". Return exactly one entry for each selected page. Every score below 5 must have evidence with matching severity for that criterion; the parser rejects scores that disagree with evidence. Findings with severity suggestion do not reduce scores. At most 18 findings and 3 problem summaries per page; at most 8 findings and 3 summaries for the set. Limitations and outside-scope observations do not affect scores.

A finding has these fields: criterion, severity, location, evidence, impact, source (relative file path or null), sourceEvidence (source excerpt/observed behaviour or null), recommendation. Page criteria are taskSuccess, usefulness, order, singleType, userLanguage, accuracy. Set criteria are navigation and consistency. Use a source and sourceEvidence for source-dependent claims; uncertainty is not a verified finding. Problem summaries must summarise the verified findings, not introduce new requirements.

Shape (a page meeting all requirements may have scores of 5 and no findings):

```json
{
  "rubricVersion": "3",
  "pages": [
    {
      "file": "copy_a_file_path.md",
      "scores": { "taskSuccess": 5, "usefulness": 5, "order": 5, "singleType": 5, "userLanguage": 5, "accuracy": 5 },
      "findings": [],
      "problems": [],
      "verdict": "The task is achievable and the supporting information is accurate."
    }
  ],
  "site": { "navigation": 5, "consistency": 5, "findings": [], "problems": [] },
  "limitations": []
}
```

Git history is read only: never stage, change branches, commit, push, create a pull request, or merge. Do not run writers, edit files, or use subagents.

## The sidebar

```ts
import { defineConfig } from 'vitepress';
import identity from '../../../../../data/identity.json';

const base = '/heidrun/';

export default defineConfig({
	title: identity.title,
	description: identity.description.en,
	head: [
		['link', {
			rel: 'icon',
			type: 'image/svg+xml',
			href: `${base}favicon.svg`,
		}],
	],
	transformPageData(pageData) {
		if (pageData.relativePath === 'index.md') {
			pageData.frontmatter.hero = {
				...pageData.frontmatter.hero,
				name: identity.title,
				text: identity.motto.en,
				tagline: identity.description.en,
			};
		}
	},
	base,
	themeConfig: {
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Documentation', link: '/documentation/' },
			{ text: 'About', link: '/about' },
		],
		sidebar: [
			{
				text: 'Documentation',
				items: [
					{ text: 'Introduction', link: '/documentation/' },
					{ text: 'Keyboard shortcuts', link: '/documentation/shortcuts' },
				],
			},
			{
				text: 'Files',
				items: [
					{
						text: 'Browse and open project files',
						link: '/documentation/browse_project_files',
					},
					{
						text: 'Create a file or folder',
						link: '/documentation/create_a_file_or_folder',
					},
					{
						text: 'Copy a file path',
						link: '/documentation/copy_a_file_path',
					},
					{
						text: 'Files sidebar section controls',
						link: '/documentation/files_sidebar_section_controls',
					},
				],
			},
		],
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/heidrun-org/heidrun' },
		],
	},
});
```

## The pages

### Page `browse_project_files.md`

Measures: {"pageType":"how-to","lineCount":45,"wordCount":629,"longestParagraphSentences":3,"paragraphRuns":5,"numberedStepCount":14,"bulletCount":4,"tableCount":0,"headingCount":9,"hasTroubleshooting":true,"relatedPageLinkCount":4}

````markdown
# Browse and open project files
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Find a file in the selected workspace and view the file in the large Git window.

## Select an existing workspace
<!-- source: docs/agents_rules/user_interface/workspaces_tabs_and_panes/workspace.md -->
<!-- source: docs/agents_rules/glossary.md -->
<!-- source: packages/apps/web_frontend/src/components/WorkspaceStatusSummary.vue -->
<!-- source: packages/apps/web_frontend/src/stores/session.ts -->

A workspace is a project folder. Choose a workspace that contains a Git repository.

1. Click the workspace name at the left end of the status bar to open the workspace information card, a small card with details and a list of workspaces.
2. Click the workspace you want in the list below the details.

The workspace information card closes, and the status bar shows the selected workspace name.

If no suitable workspace is listed, add and select a workspace:

1. Click **New workspace…** at the end of the workspace information card.
2. Choose the repository folder in the folder chooser.
3. Click the workspace name in the status bar to reopen the workspace information card.
4. Click the newly added workspace entry in the list below the details.
5. Check that the status bar shows the chosen workspace name.

## Open a project file
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: docs/agents_rules/glossary.md -->
<!-- source: packages/apps/web_frontend/src/components/GitModal.vue -->
<!-- source: packages/apps/web_frontend/src/i18n/locales/en/gitModal.json -->
<!-- source: packages/apps/web_frontend/src/stores/files.ts -->

The Files sidebar section shows the folder tree of the selected workspace's Git repository.

1. Click **Files**, the first folder icon in the left sidebar icon bar, the narrow vertical bar at the outer edge of the left sidebar, above **Scripts**.
2. Click the containing folder rows to unfold the folders and locate the file.

![Files sidebar section with docs unfolded and docs/README.md selected in the folder tree.](/documentation_images/files/files_sidebar.png)

3. Click the file row you want to open.

The file row becomes selected, and the large Git window opens over the application to show the file. Use **File** to view the whole file, or **Diff** or **Side by side** to compare changes. For an unchanged file, **Diff** and **Side by side** are disabled; the whole file is shown, or formatted Markdown if **Reading** is selected.

When finished viewing, you can press **Escape** or click **Close**, the cross at the top-right of the large Git window, to return to the Files sidebar section. The file row remains selected.

## Refresh the folder tree
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->

Use **Refresh** when a file or folder was added or removed outside Heidrun and the folder tree still shows the old list.

1. Click **Refresh**, the circular arrow in the header of the Files sidebar section.
2. If necessary, click the folder where the change was made to unfold the folder.

Check that an added file now appears or a removed file no longer appears. Refresh also removes a remembered empty folder from the folder tree when the folder no longer exists on disk.

## Troubleshooting
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->
<!-- source: packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json -->

### “Select a workspace.” appears

**Cause**: No workspace is selected.

**Solution**:

1. [Select an existing workspace](#select-an-existing-workspace) that contains a Git repository.

**Check**: The Files sidebar section shows the folder tree when the selected workspace is a Git repository.

### “This workspace is not a Git repository.” appears

**Cause**: The selected workspace is not a Git repository.

**Solution**:

1. [Select an existing workspace](#select-an-existing-workspace) that contains a Git repository.

**Check**: The Files sidebar section shows the repository's folder tree.

### Long file lists
<!-- source: packages/apps/desktop_tauri/src/files.rs -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->
<!-- source: packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json -->
<!-- source: packages/apps/web_frontend/src/components/FilesModal.vue -->
<!-- source: packages/apps/web_frontend/src/stores/files.ts -->

“The list is too long: only the first files are shown.” means that only the first 50,000 entries are available. Heidrun has no control to load the remaining entries.

Check the selected workspace in the status bar and unfold the file's containing folders. If the file is still missing while the warning appears, the folder tree may be incomplete.

## Related pages

- [Create a file or folder](/documentation/create_a_file_or_folder): to add an empty file or folder in the intended location.
- [Copy a file path](/documentation/copy_a_file_path): to use a file path outside Heidrun.
- [Files sidebar section controls](/documentation/files_sidebar_section_controls): to look up buttons and folder tree indicators.
- [Keyboard shortcuts](/documentation/shortcuts): to find the shortcut **⌘P** for opening a project file by name.
````

### Page `copy_a_file_path.md`

Measures: {"pageType":"how-to","lineCount":28,"wordCount":364,"longestParagraphSentences":2,"paragraphRuns":2,"numberedStepCount":6,"bulletCount":3,"tableCount":1,"headingCount":6,"hasTroubleshooting":true,"relatedPageLinkCount":3}

````markdown
# Copy a file path
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Copy a file path to paste into another application or a message.

## Choose the path format
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: docs/agents_rules/glossary.md -->
<!-- source: packages/apps/desktop_tauri/src/files.rs -->
<!-- source: packages/apps/web_frontend/src/stores/files.ts -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

The Git repository root is the repository's top folder. **Copy relative path** starts from the Git repository root, even when the workspace is a folder inside the repository.

For a Git repository at `/Users/alex/projects/example` and a workspace at `/Users/alex/projects/example/docs`, copying the path of `README.md` inside `docs` gives these two forms.

| Choice | Example | Use when |
| --- | --- | --- |
| **Copy absolute path** | `/Users/alex/projects/example/docs/README.md` | The receiving application needs the full location on your computer. |
| **Copy relative path** | `docs/README.md` | The receiving application or reader already knows the Git repository root. |

## Copy the path
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: docs/agents_rules/glossary.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->
<!-- source: packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json -->

First, [select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace).

1. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**, and click the containing folder rows to unfold the folders and locate the file.
2. Right-click the file row to open the context menu, a small menu of actions for the file. A left click opens the large Git window; you can right-click directly to copy the path.

![Files sidebar section with docs unfolded, docs/README.md selected, and Copy absolute path and Copy relative path in the context menu.](/documentation_images/files/copy_path.png)

3. Choose **Copy absolute path** or **Copy relative path**, using the table above.

The path is copied, the context menu closes, and a small notification briefly shows **Copied:** followed by the copied path, for example `Copied: docs/README.md`.

4. Paste the path in the other application with **⌘V**.

## Troubleshooting
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->

### The path-copy menu does not appear when a folder row is right-clicked

**Cause**: The path-copy context menu is available only for file rows.

**Solution**:

1. Click the folder row to unfold the folder if necessary.
2. Right-click a file row inside the folder.

**Check**: The context menu shows **Copy absolute path** and **Copy relative path**.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): to find the file whose path you need.
- [Create a file or folder](/documentation/create_a_file_or_folder): to add a file before copying the file path.
- [File context menu](/documentation/files_sidebar_section_controls#file-context-menu): to look up the two path-copy actions.
````

### Page `create_a_file_or_folder.md`

Measures: {"pageType":"how-to","lineCount":39,"wordCount":541,"longestParagraphSentences":2,"paragraphRuns":4,"numberedStepCount":9,"bulletCount":3,"tableCount":1,"headingCount":8,"hasTroubleshooting":true,"relatedPageLinkCount":3}

````markdown
# Create a file or folder
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Create an empty file or folder in the intended location of the selected repository.

## Choose the destination
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: docs/agents_rules/glossary.md -->
<!-- source: packages/apps/web_frontend/src/components/GitModal.vue -->

First, [select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace).

1. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**, and click the folder rows needed to unfold the destination folders. Then select the destination using the table below.

| Destination | Action |
| --- | --- |
| Inside a folder | Click the folder row to select the folder. |
| Beside an existing file | Click the file row, then press **Escape** to close the large Git window; creation uses the folder containing the selected file. |
| At the repository root, outside any subfolder | If needed, click **Collapse all folders** to fold every folder, then click empty space outside all rows in the Files sidebar section to clear the selection. When nothing is selected, creation uses the repository root. |

If the rows still fill the Files sidebar section after folding, there is no separate control to clear the selection.

## Create the file or folder
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

1. Click **New file**, the file icon with a plus sign, or **New folder**, the folder icon with a plus sign, in the header of the Files sidebar section.
2. Type only the new name in the name box at the top of the contents of the destination folder, or at the top of the folder tree when creating at the repository root.

![New file name box inside docs with example.md typed before Enter is pressed.](/documentation_images/files/new_file.png)

3. Press **Enter**.

The new empty file or folder becomes the selected row. A new file also opens in the [large Git window described in Browse and open project files](/documentation/browse_project_files#open-a-project-file).

A newly created folder that is still empty disappears from the folder tree when Heidrun restarts. The folder remains on disk.

## Cancel creation
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->

1. Press **Escape** while the name box is open, or click outside the name box.

The name box closes without creating a file or folder.

## Troubleshooting
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->
<!-- source: packages/apps/desktop_tauri/src/files.rs -->

### “un fichier ou dossier porte déjà ce nom” appears and the name box stays open

**Cause**: A file or folder with the entered name already exists in the destination folder.

The error appears in a small notification and is always in French, even with the English interface. The message means “a file or folder already has this name”.

**Solution**:

1. Replace the entered name with a name that is not already used in the destination folder.
2. Press **Enter**.

**Check**: The name box closes and the new file or folder becomes the selected row.

### “A name cannot contain the character /. Select a folder first.” appears

**Cause**: The entered name contains `/` instead of being only a file or folder name.

**Solution**:

1. Remove `/` from the name in the name box, which remains open.
2. Press **Enter**.

**Check**: The new file or folder becomes the selected row inside the destination folder.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): to select a workspace and view the new file.
- [Copy a file path](/documentation/copy_a_file_path): to copy the path of the new file.
- [Files sidebar section controls](/documentation/files_sidebar_section_controls): to identify the header buttons and changed-file letters.
````

### Page `files_sidebar_section_controls.md`

Measures: {"pageType":"reference","lineCount":64,"wordCount":805,"longestParagraphSentences":2,"paragraphRuns":3,"numberedStepCount":0,"bulletCount":3,"tableCount":6,"headingCount":9,"hasTroubleshooting":false,"relatedPageLinkCount":3}

````markdown
# Files sidebar section controls
<!-- generated by docs:update_by_ai -->
<!-- page type: reference -->

Look up the controls, appearance choices, and row indicators of the Files sidebar section.

## Header buttons
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

The header stays at the top while the rows scroll. The five buttons show only icons, in this order from left to right.

| Button | Icon | Purpose |
| --- | --- | --- |
| **New file** | File with a plus sign | Opens a name box for an empty file in the selected destination. |
| **New folder** | Folder with a plus sign | Opens a name box for an empty folder in the selected destination. |
| **Refresh** | Circular arrow | Reads the folder tree again; disabled while the folder tree loads. |
| **Collapse all folders** | Square with a minus sign | Folds every folder. |
| **More options** | Three vertical dots | Opens the appearance choices for the folder tree. |

![Files sidebar section header buttons with the More options menu open.](/documentation_images/files/more_options.png)

There is no button to unfold every folder.

## Row and name box actions
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

| Action | Result |
| --- | --- |
| Click a folder row | Selects the folder and folds or unfolds the folder, unless the folder is ignored. |
| Click a file row | Selects the file and opens the file in the large Git window. |
| Right-click a file row | Opens the file context menu without opening the large Git window. |
| Click empty space outside all rows | Clears the selection in the selected workspace. |
| Press **Enter** in the name box | Creates the file or folder for a valid, nonempty name; an error keeps the name box open. |
| Press **Escape** in the name box, or click outside the name box | Cancels creation. |

## More options
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->

A check mark identifies the active choice in each group. The appearance choices are saved.

| Group | Choices | Default | Meaning |
| --- | --- | --- | --- |
| **Indentation** | **Small**, **Medium**, **Large** | **Medium** | The horizontal space added for each folder level. |
| **Row height** | **Compact**, **Comfortable** | **Comfortable** | The vertical space occupied by each row. |
| **Indent guides** | **Show**, **Hide** | **Show** | Whether lines mark the folder levels. |

## File context menu
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: docs/agents_rules/glossary.md -->
<!-- source: packages/apps/desktop_tauri/src/files.rs -->
<!-- source: packages/apps/web_frontend/src/stores/files.ts -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

A context menu is a small menu of actions for a row. These items are available for file rows only.

| Item | Copied text |
| --- | --- |
| **Copy absolute path** | The full path of the file. |
| **Copy relative path** | The path from the Git repository's top folder; for `README.md` inside the repository's `docs` folder, a workspace ending in `/docs` still copies `docs/README.md`. |

See [Copy a file path](/documentation/copy_a_file_path) for examples and copying steps.

## Folder tree indicators
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->
<!-- source: packages/apps/desktop_tauri/src/files.rs -->

Folders appear before files, with each group in alphabetical order.

| Indicator | Meaning |
| --- | --- |
| Right-pointing folder arrow | The folder is folded. |
| Downward-pointing folder arrow | The folder is unfolded. |
| Row with a blue outline | The selected file or folder; only one row is selected. |
| **M** | A modified file. |
| **A** | An added file. |
| **D** | A deleted file. |
| **R** | A renamed file. |
| **U** | A new file that Git does not track yet. |
| Dot on a folder row | Changes exist inside the folder. |

Changed-file letters appear at the right of the file row.

## Selection
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json -->
<!-- source: packages/apps/web_frontend/src/components/FilesModal.vue -->
<!-- source: packages/apps/web_frontend/src/i18n/locales/en/filesModal.json -->
<!-- source: packages/apps/web_frontend/src/stores/files.ts -->
<!-- source: packages/apps/web_frontend/src/stores/settings.ts -->
<!-- source: packages/apps/desktop_tauri/src/files.rs -->

| Item | Meaning |
| --- | --- |
| Selected row | Each workspace keeps a separate selection. Returning to a workspace restores the selected row with the folders above the row unfolded. |
| Closing the large Git window | The selected row remains selected. |
| Changing the sidebar section | The selected row and the folded or unfolded state of folders are retained. |

## Ignored files
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json -->
<!-- source: packages/apps/web_frontend/src/components/FilesModal.vue -->
<!-- source: packages/apps/web_frontend/src/i18n/locales/en/filesModal.json -->
<!-- source: packages/apps/web_frontend/src/stores/files.ts -->
<!-- source: packages/apps/web_frontend/src/stores/settings.ts -->
<!-- source: packages/apps/desktop_tauri/src/files.rs -->

The Files window is the project file browser opened with **⌘P**, as listed in [Keyboard shortcuts](/documentation/shortcuts). The **Ignored files** checkbox is below the file-name search field in the **Files** view on the left of the Files window.

The choice is saved and also affects the Files sidebar section. Folders excluded by `.gitignore` appear when the checkbox is selected, but cannot unfold.

See [Create a file or folder](/documentation/create_a_file_or_folder#create-the-file-or-folder) for empty-folder behaviour and [Browse and open project files](/documentation/browse_project_files#long-file-lists) for the long-list limitation.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): to find and view a file.
- [Create a file or folder](/documentation/create_a_file_or_folder): to choose a destination and create an empty file or folder.
- [Copy a file path](/documentation/copy_a_file_path): to copy either form of a file path.
````
