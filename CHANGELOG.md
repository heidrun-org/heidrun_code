# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.5] - 2026-10-28

### Added

- Added a topic timeline to the Chats sidebar section. ([#944](https://github.com/heidrun-org/heidrun_code/pull/944)).
- Show images from Claude Code and Codex chats in the Clipboard sidebar section, including the image referenced by `[Image #N]` under the pointer. ([#919](https://github.com/heidrun-org/heidrun_code/pull/919), [#939](https://github.com/heidrun-org/heidrun_code/pull/939)).
- Added HTML previews to the File view pane. ([#936](https://github.com/heidrun-org/heidrun_code/pull/936)).
- Added file editing, ⌘P, Search in files, and the option to ask a coding agent about selected lines in the File view pane. ([#911](https://github.com/heidrun-org/heidrun_code/pull/911)).
- Added a read-only pane for viewing the changes to a file. ([#896](https://github.com/heidrun-org/heidrun_code/pull/896)).
- Added “Chat about this file” to the File explorer context menu and a button to start a chat from an issue information card. ([#856](https://github.com/heidrun-org/heidrun_code/pull/856), [#852](https://github.com/heidrun-org/heidrun_code/pull/852)).
- Added a word replacement list for correcting voice input. ([#840](https://github.com/heidrun-org/heidrun_code/pull/840)).
- Added a system notification switch, a sound, and a test button for each kind of notification. ([#858](https://github.com/heidrun-org/heidrun_code/pull/858)).
- Added application logs for code hosting commands, voice input, data updates, Git operations, the mobile server, application startup, and voice model downloads. Voice recording logs include the model and language. ([#884](https://github.com/heidrun-org/heidrun_code/pull/884), [#907](https://github.com/heidrun-org/heidrun_code/pull/907), [#909](https://github.com/heidrun-org/heidrun_code/pull/909), [#933](https://github.com/heidrun-org/heidrun_code/pull/933)).
- Added database update stages and progress to the Statistics window. ([#880](https://github.com/heidrun-org/heidrun_code/pull/880)).
- Added user documentation with screenshots and a command for updating the documentation. ([#927](https://github.com/heidrun-org/heidrun_code/pull/927), [#940](https://github.com/heidrun-org/heidrun_code/pull/940)).
- Added the option to move a dragged pane into a new tab by dropping the pane on the plus button in the tab bar. ([#830](https://github.com/heidrun-org/heidrun_code/pull/830)).

### Changed

- Renamed the application to Heidrun Code and updated application identifiers, repository links, and the website address. ([#844](https://github.com/heidrun-org/heidrun_code/pull/844), [#846](https://github.com/heidrun-org/heidrun_code/pull/846), [#842](https://github.com/heidrun-org/heidrun_code/pull/842), [#838](https://github.com/heidrun-org/heidrun_code/pull/838)).
- Made dynamic topics more specific and reduced the cost of generating dynamic topics. ([#942](https://github.com/heidrun-org/heidrun_code/pull/942), [#943](https://github.com/heidrun-org/heidrun_code/pull/943)).
- Voice input now supports switching tabs and workspaces, with queued transcriptions, a notification, and a recording icon. ([#917](https://github.com/heidrun-org/heidrun_code/pull/917)).
- Markdown previews now use the full width by default, with a “Wrap at 80 columns” switch. ([#908](https://github.com/heidrun-org/heidrun_code/pull/908)).
- Code hosting lists now remain cached until refreshed. Lists show up to 30 items, explain refresh failures and rate limits, and show the age of retained results and the local reset time for GitHub and GitLab rate limits. ([#878](https://github.com/heidrun-org/heidrun_code/pull/878), [#891](https://github.com/heidrun-org/heidrun_code/pull/891), [#913](https://github.com/heidrun-org/heidrun_code/pull/913), [#871](https://github.com/heidrun-org/heidrun_code/pull/871), [#918](https://github.com/heidrun-org/heidrun_code/pull/918)).
- Custom launchers can now belong to the user or to a workspace. ([#859](https://github.com/heidrun-org/heidrun_code/pull/859)).
- Find new skills now lists every skill in a folder and compares discovered skills with installed skills. ([#866](https://github.com/heidrun-org/heidrun_code/pull/866)).
- Data updates now write only changed memory files, subagents, and skills. ([#860](https://github.com/heidrun-org/heidrun_code/pull/860)).
- Release notes are now organized by topic, and the change log generator removes the Unreleased section when writing a release section. ([#834](https://github.com/heidrun-org/heidrun_code/pull/834), [#835](https://github.com/heidrun-org/heidrun_code/pull/835), [#861](https://github.com/heidrun-org/heidrun_code/pull/861)).

### Removed

- Removed the Files window and the large Git window. ([#906](https://github.com/heidrun-org/heidrun_code/pull/906)).
- Removed command-line links and skills that used former application names. ([#914](https://github.com/heidrun-org/heidrun_code/pull/914)).
- Removed support for former data folders; the application now uses only `heidrun_code` and `heidrun_code_development`. ([#920](https://github.com/heidrun-org/heidrun_code/pull/920)).
- Removed the separate data layer operation log; data layer events are recorded in the application log. ([#912](https://github.com/heidrun-org/heidrun_code/pull/912)).

### Fixed

- Made the dynamic topic bar arrows visible and enabled scrolling with a trackpad. ([#947](https://github.com/heidrun-org/heidrun_code/pull/947)).
- Fixed symbolic links to folders appearing as files in the File explorer. ([#938](https://github.com/heidrun-org/heidrun_code/pull/938)).
- The File view pane now updates when the file changes on disk. ([#934](https://github.com/heidrun-org/heidrun_code/pull/934)).
- Fixed the background and internal links in Markdown previews. ([#929](https://github.com/heidrun-org/heidrun_code/pull/929)).
- Corrected AI cost calculations for several workspaces used during the same hour. ([#895](https://github.com/heidrun-org/heidrun_code/pull/895)).
- Open the composition bar at startup for coding agents that remained running. ([#867](https://github.com/heidrun-org/heidrun_code/pull/867)).
- Closing the selected tab now focuses the most recently used pane in another tab. ([#863](https://github.com/heidrun-org/heidrun_code/pull/863)).
- Fixed blog links that still pointed to the former website address. ([#937](https://github.com/heidrun-org/heidrun_code/pull/937)).

## [0.3.0] - 2026-10-23

### Added

- Use Heidrun Mobile to access workspaces, terminals, launchers, macros, and voice input from a mobile browser. ([#529](https://github.com/heidrun-org/heidrun/pull/529), [#544](https://github.com/heidrun-org/heidrun/pull/544), [#550](https://github.com/heidrun-org/heidrun/pull/550), [#599](https://github.com/heidrun-org/heidrun/pull/599), [#775](https://github.com/heidrun-org/heidrun/pull/775))
- Dictate into the composition bar with optional push-to-talk voice input, and cancel transcription when needed. ([#668](https://github.com/heidrun-org/heidrun/pull/668), [#740](https://github.com/heidrun-org/heidrun/pull/740), [#766](https://github.com/heidrun-org/heidrun/pull/766), [#823](https://github.com/heidrun-org/heidrun/pull/823))
- Use a composition bar and draft for each pane, choose whether it opens when a coding agent starts, and keep it open after sending a message. ([#665](https://github.com/heidrun-org/heidrun/pull/665), [#672](https://github.com/heidrun-org/heidrun/pull/672), [#718](https://github.com/heidrun-org/heidrun/pull/718), [#732](https://github.com/heidrun-org/heidrun/pull/732))
- Turn on Zen Mode for focused work, and keep the Zen button available in every pane. ([#713](https://github.com/heidrun-org/heidrun/pull/713), [#735](https://github.com/heidrun-org/heidrun/pull/735))
- Browse Git worktrees and submodules in the File explorer, and open a worktree as a workspace. ([#689](https://github.com/heidrun-org/heidrun/pull/689), [#763](https://github.com/heidrun-org/heidrun/pull/763))
- View a selected file in a read-only pane, with its front matter displayed in a card. ([#801](https://github.com/heidrun-org/heidrun/pull/801), [#783](https://github.com/heidrun-org/heidrun/pull/783))
- Save searches at the user or workspace level, with an information card explaining each level. ([#824](https://github.com/heidrun-org/heidrun/pull/824))
- Manage macros and launchers from the command line, and create, edit, or delete macros from the macro menu. ([#604](https://github.com/heidrun-org/heidrun/pull/604), [#659](https://github.com/heidrun-org/heidrun/pull/659), [#757](https://github.com/heidrun-org/heidrun/pull/757))
- Open a workspace from the workspace selector, which now shows a link to its repository. ([#782](https://github.com/heidrun-org/heidrun/pull/782))
- See more activity and usage information in Statistics, including cost or token use across multiple workspaces, and choose the time range and measures to display. ([#528](https://github.com/heidrun-org/heidrun/pull/528), [#555](https://github.com/heidrun-org/heidrun/pull/555), [#563](https://github.com/heidrun-org/heidrun/pull/563), [#625](https://github.com/heidrun-org/heidrun/pull/625), [#628](https://github.com/heidrun-org/heidrun/pull/628), [#633](https://github.com/heidrun-org/heidrun/pull/633), [#710](https://github.com/heidrun-org/heidrun/pull/710))
- Find skills from three sources, including folders in GitLab, with help cards for search options. ([#614](https://github.com/heidrun-org/heidrun/pull/614))
- View and change project guards in Settings. ([#606](https://github.com/heidrun-org/heidrun/pull/606))
- Choose an optional goat sound in Settings. ([#623](https://github.com/heidrun-org/heidrun/pull/623))
- Install Heidrun with one command, and visit the expanded public website. ([#516](https://github.com/heidrun-org/heidrun/pull/516), [#518](https://github.com/heidrun-org/heidrun/pull/518), [#519](https://github.com/heidrun-org/heidrun/pull/519), [#520](https://github.com/heidrun-org/heidrun/pull/520), [#535](https://github.com/heidrun-org/heidrun/pull/535))
- Explore experiments that animate repository activity and turn Git commits into a parallax dinosaur runner. ([#532](https://github.com/heidrun-org/heidrun/pull/532), [#539](https://github.com/heidrun-org/heidrun/pull/539), [#543](https://github.com/heidrun-org/heidrun/pull/543))

### Changed

- Move panes within a tab or between tabs by dragging and dropping them. ([#819](https://github.com/heidrun-org/heidrun/pull/819))
- Keep coding agents running after Heidrun quits by default. ([#765](https://github.com/heidrun-org/heidrun/pull/765))
- Keep saved options when Heidrun updates. ([#794](https://github.com/heidrun-org/heidrun/pull/794))
- See the selected workspace name in the top bar search button, and resize the workspace list in the Needs you section. ([#755](https://github.com/heidrun-org/heidrun/pull/755), [#809](https://github.com/heidrun-org/heidrun/pull/809))
- Search each code hosting list separately, with clearer search help and expanded cards. ([#612](https://github.com/heidrun-org/heidrun/pull/612), [#746](https://github.com/heidrun-org/heidrun/pull/746))
- Find Settings options in eight topic sections, with an information card for each option. ([#560](https://github.com/heidrun-org/heidrun/pull/560), [#615](https://github.com/heidrun-org/heidrun/pull/615))
- Choose how Heidrun detects terminal text in Settings. ([#797](https://github.com/heidrun-org/heidrun/pull/797))
- Use Codex with the light theme. ([#651](https://github.com/heidrun-org/heidrun/pull/651))
- Run Heidrun on macOS 11 or later. ([#671](https://github.com/heidrun-org/heidrun/pull/671))

### Fixed

- Copy selected terminal text reliably, preserve command lines when copying wrapped text, and copy issue or pull request web addresses from their information cards. ([#804](https://github.com/heidrun-org/heidrun/pull/804), [#806](https://github.com/heidrun-org/heidrun/pull/806), [#774](https://github.com/heidrun-org/heidrun/pull/774), [#817](https://github.com/heidrun-org/heidrun/pull/817), [#821](https://github.com/heidrun-org/heidrun/pull/821))
- Keep the usage wheel information card inside the window and hide the wheel when the pointer leaves its pane. ([#798](https://github.com/heidrun-org/heidrun/pull/798), [#802](https://github.com/heidrun-org/heidrun/pull/802))
- Make the macro menu easier to use and keep flying smileys at a consistent size. ([#777](https://github.com/heidrun-org/heidrun/pull/777), [#800](https://github.com/heidrun-org/heidrun/pull/800))
- Improve status indicators and make Finished results acknowledgeable across the desktop. ([#768](https://github.com/heidrun-org/heidrun/pull/768), [#771](https://github.com/heidrun-org/heidrun/pull/771))
- Show only open workspaces in Statistics, User activity. ([#684](https://github.com/heidrun-org/heidrun/pull/684))
- Make mobile access stop old tunnels left running by Heidrun. ([#584](https://github.com/heidrun-org/heidrun/pull/584), [#587](https://github.com/heidrun-org/heidrun/pull/587))
- Help installed Heidrun find `gh`, and enable installed coding agents. ([#661](https://github.com/heidrun-org/heidrun/pull/661), [#699](https://github.com/heidrun-org/heidrun/pull/699))

## [0.2.7] - 2026-10-15

### Added

- Install a skill from the web address of its folder on GitHub. ([#507](https://github.com/heidrun-org/heidrun/pull/507))
- View developer activity in the Statistics window, with selectable slot lengths and workspaces, stacked bars, a legend, and chart information cards. ([#481](https://github.com/heidrun-org/heidrun/pull/481), [#491](https://github.com/heidrun-org/heidrun/pull/491), [#505](https://github.com/heidrun-org/heidrun/pull/505))
- View one person’s work in the Statistics window. ([#485](https://github.com/heidrun-org/heidrun/pull/485))
- Show a usage wheel for a pane’s context window, with an information card. ([#479](https://github.com/heidrun-org/heidrun/pull/479))
- Show tokens and estimated cost for each chat in the Past chats sidebar section. ([#447](https://github.com/heidrun-org/heidrun/pull/447))
- Detect developer activity and show it in the User activity sidebar section. ([#454](https://github.com/heidrun-org/heidrun/pull/454))
- Fetch the remote repository in the background, with a setting for the delay. ([#434](https://github.com/heidrun-org/heidrun/pull/434))
- Add an option to show ignored files in the File explorer sidebar section. ([#437](https://github.com/heidrun-org/heidrun/pull/437))
- Add saved searches to the Code hosting sidebar section. ([#377](https://github.com/heidrun-org/heidrun/pull/377))
- Add the Code hosting sidebar section. ([#373](https://github.com/heidrun-org/heidrun/pull/373))
- Add back and forward navigation through the history of focused panes. ([#387](https://github.com/heidrun-org/heidrun/pull/387))
- Start the default command when splitting a pane or adding a tab. ([#478](https://github.com/heidrun-org/heidrun/pull/478))
- Select a new workspace immediately and run the default command in its first tab. ([#421](https://github.com/heidrun-org/heidrun/pull/421))
- Show the list of workspaces at the bottom of the Needs you sidebar section. ([#418](https://github.com/heidrun-org/heidrun/pull/418))
- Show the date and time of the build in the About Heidrun window. ([#477](https://github.com/heidrun-org/heidrun/pull/477))
- Add a window with a Three.js demo to the desktop application. ([#399](https://github.com/heidrun-org/heidrun/pull/399))
- Add a video explaining how to pronounce Heiðrún to the website’s About page. ([#402](https://github.com/heidrun-org/heidrun/pull/402))
- Add context menus to file and folder rows in the File explorer sidebar section. ([#385](https://github.com/heidrun-org/heidrun/pull/385), [#445](https://github.com/heidrun-org/heidrun/pull/445))
- Add the option to enable or disable dynamic topics in Settings. ([#429](https://github.com/heidrun-org/heidrun/pull/429))

### Changed

- Keep terminals in open tabs running when switching tabs. ([#496](https://github.com/heidrun-org/heidrun/pull/496))
- Update the Statistics window with tab buttons in a thin title bar and helpful tooltips. ([#497](https://github.com/heidrun-org/heidrun/pull/497))
- Use theme colors for the Needs you cards and show a question mark after abbreviated times with the exact time in its tooltip. ([#502](https://github.com/heidrun-org/heidrun/pull/502))
- Make the User and Workspace choices look like the Language choice. ([#492](https://github.com/heidrun-org/heidrun/pull/492))
- Move the large Git window controls to the title bar and rename “Reading” to “Preview.” ([#448](https://github.com/heidrun-org/heidrun/pull/448))
- Give the Clipboard and Needs you sidebar sections titles like the other sidebar sections. ([#433](https://github.com/heidrun-org/heidrun/pull/433))
- Replace the “All workspaces” check box in the Clipboard sidebar section with a switch. ([#436](https://github.com/heidrun-org/heidrun/pull/436))
- Rename the Files sidebar section to File explorer, Notes to Clipboard, Scripts to Launchers, and Chats to Past chats. ([#437](https://github.com/heidrun-org/heidrun/pull/437), [#436](https://github.com/heidrun-org/heidrun/pull/436), [#431](https://github.com/heidrun-org/heidrun/pull/431), [#426](https://github.com/heidrun-org/heidrun/pull/426))
- Rebuild the Settings window with Bootstrap components. ([#416](https://github.com/heidrun-org/heidrun/pull/416))
- Show each chat’s worktree name in its summary. ([#413](https://github.com/heidrun-org/heidrun/pull/413))
- Show a clear message when another client holds a terminal, and give each worktree its own Herdr session. ([#484](https://github.com/heidrun-org/heidrun/pull/484))
- Read the models and effort levels from each coding agent’s tool, and add Antigravity to the coding agent list. ([#393](https://github.com/heidrun-org/heidrun/pull/393), [#395](https://github.com/heidrun-org/heidrun/pull/395))
- Import scripts from any repository `package.json` and add the current working directory to the Command line kind. ([#388](https://github.com/heidrun-org/heidrun/pull/388))
- Improve the Code hosting sidebar section’s logo, buttons, and saved search windows. ([#384](https://github.com/heidrun-org/heidrun/pull/384))
- Rebuild the Scripts sidebar section and the Create a custom script window. ([#382](https://github.com/heidrun-org/heidrun/pull/382))
- Add a Flux Lines background to the public website homepage. ([#439](https://github.com/heidrun-org/heidrun/pull/439))
- Remove the fixed maximum width of the left and right sidebars. ([#397](https://github.com/heidrun-org/heidrun/pull/397))

### Removed

- Remove Visual Studio Code variables from the Herdr server environment. ([#480](https://github.com/heidrun-org/heidrun/pull/480))

### Fixed

- Prevent closing the last tab in a workspace and show an error notification. ([#427](https://github.com/heidrun-org/heidrun/pull/427))
- Show folders ignored by Git only once in the File explorer sidebar section. ([#444](https://github.com/heidrun-org/heidrun/pull/444))

## [0.2.5] - 2026-10-13

### Added

- Add a Files section to the sidebar. ([#351](https://github.com/heidrun-org/heidrun/pull/351))
- Add a setting to choose the default command for new tabs. ([#330](https://github.com/heidrun-org/heidrun/pull/330))
- Add a setting to ask before closing tabs, workspaces, or the application. ([#310](https://github.com/heidrun-org/heidrun/pull/310), [#334](https://github.com/heidrun-org/heidrun/pull/334))
- Add icons to sidebar sections and let each sidebar collapse to an icon bar. ([#308](https://github.com/heidrun-org/heidrun/pull/308))
- Add a Source control section to the sidebar. ([#307](https://github.com/heidrun-org/heidrun/pull/307))
- Add dynamic topics to the Chats section, with a language model extraction method. ([#268](https://github.com/heidrun-org/heidrun/pull/268), [#273](https://github.com/heidrun-org/heidrun/pull/273))
- Add a sort menu to the Chats section. ([#263](https://github.com/heidrun-org/heidrun/pull/263))
- Add goat sounds to the About window, splash screen, and empty tab screen. ([#258](https://github.com/heidrun-org/heidrun/pull/258))
- Add the Chats section to the sidebar. ([#259](https://github.com/heidrun-org/heidrun/pull/259))
- Add a command line option to start without the splash screen. ([#255](https://github.com/heidrun-org/heidrun/pull/255))
- Add a workspace selector to the status bar. ([#244](https://github.com/heidrun-org/heidrun/pull/244))
- Add a tab bar and a workspace button. ([#213](https://github.com/heidrun-org/heidrun/pull/213), [#212](https://github.com/heidrun-org/heidrun/pull/212))
- Add a setting to show or hide the status item in the macOS menu bar. ([#170](https://github.com/heidrun-org/heidrun/pull/170))
- Add a macOS menu bar item showing agent states and Claude quota. ([#164](https://github.com/heidrun-org/heidrun/pull/164))
- Add a custom script creation window. ([#151](https://github.com/heidrun-org/heidrun/pull/151))
- Add an Agents information window. ([#148](https://github.com/heidrun-org/heidrun/pull/148))
- Add a top bar menu for settings and skills. ([#144](https://github.com/heidrun-org/heidrun/pull/144))
- Add an Agents section to Settings. ([#123](https://github.com/heidrun-org/heidrun/pull/123))
- Add a tool for coding agents that can be used as a library or from the command line. ([#116](https://github.com/heidrun-org/heidrun/pull/116))
- Add support for pasting an image by dropping it onto a terminal. ([#115](https://github.com/heidrun-org/heidrun/pull/115))
- Add a command to create a disk image for release. ([#110](https://github.com/heidrun-org/heidrun/pull/110))

### Changed

- Remember the selected workspace and restore it when Heidrun starts. ([#356](https://github.com/heidrun-org/heidrun/pull/356))
- Synchronize with the upstream branch from the status bar and switch Git branches there. ([#354](https://github.com/heidrun-org/heidrun/pull/354), [#352](https://github.com/heidrun-org/heidrun/pull/352))
- Make the selected pane easier to see. ([#347](https://github.com/heidrun-org/heidrun/pull/347))
- Make Command+T start the default command in a new tab. ([#346](https://github.com/heidrun-org/heidrun/pull/346))
- Use the theme colors for notifications in light mode. ([#344](https://github.com/heidrun-org/heidrun/pull/344))
- Change the Working status color from blue to violet. ([#339](https://github.com/heidrun-org/heidrun/pull/339))
- Update the public website shortcuts page. ([#358](https://github.com/heidrun-org/heidrun/pull/358))
- Make panes meet the viewport border and each other, with thin lines and square corners. ([#329](https://github.com/heidrun-org/heidrun/pull/329))
- Give each status bar section a rounded background when the pointer is over it. ([#327](https://github.com/heidrun-org/heidrun/pull/327))
- Use the colors of Visual Studio Code Dark Modern and Light Modern. ([#321](https://github.com/heidrun-org/heidrun/pull/321))
- Make the Workspace information card wider and scroll long folder paths. ([#322](https://github.com/heidrun-org/heidrun/pull/322))
- Add the Heidrun favicon to the public website. ([#319](https://github.com/heidrun-org/heidrun/pull/319))
- Collapse sidebars instead of hiding them. ([#318](https://github.com/heidrun-org/heidrun/pull/318))
- Make the status item narrower so macOS does not hide it behind the camera notch. ([#314](https://github.com/heidrun-org/heidrun/pull/314))
- Make the Claude and Codex usage information cards wider. ([#291](https://github.com/heidrun-org/heidrun/pull/291))
- Show colored status dots and quota badges in the status item menu. ([#287](https://github.com/heidrun-org/heidrun/pull/287))
- Show pinned notes in their own workspace and keep pinned panes the same width across tabs. ([#221](https://github.com/heidrun-org/heidrun/pull/221), [#218](https://github.com/heidrun-org/heidrun/pull/218))
- Center the Shortcuts window. ([#216](https://github.com/heidrun-org/heidrun/pull/216))
- Make both sidebars hide completely. ([#215](https://github.com/heidrun-org/heidrun/pull/215))
- Create the workspace button at the left end of the tab bar. ([#213](https://github.com/heidrun-org/heidrun/pull/213))
- Let users reorder tabs, workspaces, and notes with the mouse while keeping image drops working. ([#249](https://github.com/heidrun-org/heidrun/pull/249))
- Move the workspace selector into the status bar and show its list in an information card. ([#244](https://github.com/heidrun-org/heidrun/pull/244))
- Make the workspace button and tabs larger, with icons. ([#241](https://github.com/heidrun-org/heidrun/pull/241))
- Make the whole tab clickable and move its close button closer to the right edge. ([#236](https://github.com/heidrun-org/heidrun/pull/236))
- Show a pinned pane at the same width in every tab. ([#218](https://github.com/heidrun-org/heidrun/pull/218))
- Show a baby goat, Heidrun's name, and a joke with a firework on an empty tab screen. ([#185](https://github.com/heidrun-org/heidrun/pull/185))
- Replace the application icon with a goat that is clear at small sizes, and use it as the website favicon. ([#183](https://github.com/heidrun-org/heidrun/pull/183))
- Resize panes by height and in two directions from a corner. ([#177](https://github.com/heidrun-org/heidrun/pull/177))
- Name a shell pane after its folder or running command. ([#171](https://github.com/heidrun-org/heidrun/pull/171))
- Show only the quotas for coding agents enabled in Settings. ([#140](https://github.com/heidrun-org/heidrun/pull/140))
- Link installed skills when an agent is enabled later. ([#128](https://github.com/heidrun-org/heidrun/pull/128))
- Drop the title bar name and splash screen subtitle. ([#159](https://github.com/heidrun-org/heidrun/pull/159), [#155](https://github.com/heidrun-org/heidrun/pull/155))
- Apply font size zoom to the whole window. ([#111](https://github.com/heidrun-org/heidrun/pull/111))

### Removed

- Remove the status bar section showing the number of agents by state. ([#288](https://github.com/heidrun-org/heidrun/pull/288))
- Remove the Pane section from the right sidebar. ([#282](https://github.com/heidrun-org/heidrun/pull/282))
- Remove unused text after the layout redesign. ([#222](https://github.com/heidrun-org/heidrun/pull/222))

### Fixed

- Increase the timeout for each web frontend test to 30 seconds. ([#362](https://github.com/heidrun-org/heidrun/pull/362))
- Keep the gap between the viewport and a collapsed sidebar. ([#325](https://github.com/heidrun-org/heidrun/pull/325))
- Keep the status item menu text black and open quota cards. ([#294](https://github.com/heidrun-org/heidrun/pull/294))
- Show the empty tab screen in light colors when using the light theme. ([#187](https://github.com/heidrun-org/heidrun/pull/187))
- Prevent terminal text from blinking or shifting while the window is resized. ([#158](https://github.com/heidrun-org/heidrun/pull/158))
- Keep pane names clear of the buttons in narrow panes. ([#153](https://github.com/heidrun-org/heidrun/pull/153))
- Remove the black window that appeared before the splash screen. ([#145](https://github.com/heidrun-org/heidrun/pull/145))

## [0.2.0] - 2026-10-10

### Added

- See Git information and agent activity in the status bar, with hover cards for more details. ([#87](https://github.com/heidrun-org/heidrun/pull/87), [#85](https://github.com/heidrun-org/heidrun/pull/85))
- See Codex quota information and usage pace, and configure general settings. ([#83](https://github.com/heidrun-org/heidrun/pull/83))
- Reorder panes in the sidebar by dragging their rows. ([#91](https://github.com/heidrun-org/heidrun/pull/91))
- Rename workspaces from a menu in each workspace row. ([#96](https://github.com/heidrun-org/heidrun/pull/96))
- Add English and French interface languages. ([#26](https://github.com/heidrun-org/heidrun/pull/26))
- Choose a template from the pane header when creating a pane. ([#58](https://github.com/heidrun-org/heidrun/pull/58))
- Show a splash screen and an image in the About window. ([#56](https://github.com/heidrun-org/heidrun/pull/56))
- Add a public website for Heidrun. ([#70](https://github.com/heidrun-org/heidrun/pull/70))
- Add light and dark themes. ([#24](https://github.com/heidrun-org/heidrun/pull/24))
- Add a tooltip to every clickable element. ([#23](https://github.com/heidrun-org/heidrun/pull/23))
- Add the MIT license. ([#12](https://github.com/heidrun-org/heidrun/pull/12), [#13](https://github.com/heidrun-org/heidrun/pull/13))

### Changed

- Open workspace status cards from anywhere in their section, and keep them open longer. ([#106](https://github.com/heidrun-org/heidrun/pull/106))
- Replace pane tabs with rows that include a menu and close button. ([#47](https://github.com/heidrun-org/heidrun/pull/47))
- Combine the top bar buttons into one Settings window with a sidebar. ([#61](https://github.com/heidrun-org/heidrun/pull/61))
- Use a single plus icon to create panes, remember entered values, and confirm with Enter. ([#63](https://github.com/heidrun-org/heidrun/pull/63))
- Show pane status until a row is hovered, then show its buttons. ([#49](https://github.com/heidrun-org/heidrun/pull/49))
- Replace the New agent and New terminal buttons with icons in the Panes header. ([#43](https://github.com/heidrun-org/heidrun/pull/43))
- Use the system language for application menu labels. ([#59](https://github.com/heidrun-org/heidrun/pull/59))
- Rename the application to Heidrun and migrate existing data. ([#53](https://github.com/heidrun-org/heidrun/pull/53), [#52](https://github.com/heidrun-org/heidrun/pull/52))
- Use Bootstrap Icons throughout the application, including a pin for keep-beside. ([#19](https://github.com/heidrun-org/heidrun/pull/19), [#20](https://github.com/heidrun-org/heidrun/pull/20))
- Move the project configuration to `.heidrun/config.json`, checked with a schema. ([#67](https://github.com/heidrun-org/heidrun/pull/67))
- Use identical plus buttons in the sidebar. ([#65](https://github.com/heidrun-org/heidrun/pull/65))

### Removed

- Remove the GitLab issue creation script and issue templates. ([#39](https://github.com/heidrun-org/heidrun/pull/39), [#18](https://github.com/heidrun-org/heidrun/pull/18))
- Remove the `docs/issues` folder. ([#36](https://github.com/heidrun-org/heidrun/pull/36))

### Fixed

- Make the Codex input area readable in light mode. ([#101](https://github.com/heidrun-org/heidrun/pull/101))
- Show a star after the branch name when the working folder has uncommitted changes. ([#89](https://github.com/heidrun-org/heidrun/pull/89))
- Show only one pane rename field, where the rename started. ([#95](https://github.com/heidrun-org/heidrun/pull/95))
- Use soft border colours around the terminal pane in the light theme. ([#28](https://github.com/heidrun-org/heidrun/pull/28))
- Show a spinner on the Refresh button while it refreshes. ([#25](https://github.com/heidrun-org/heidrun/pull/25))
- Show a modal dialog to confirm closing the application. ([#29](https://github.com/heidrun-org/heidrun/pull/29))
- Make the scroll bar of the terminal panel no longer white. ([#108](https://github.com/heidrun-org/heidrun/pull/108))
