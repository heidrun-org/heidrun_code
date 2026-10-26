# Agent rules index

- Created: 13 October 2026
- Last updated: 25 October 2026
- Status: Maintained index for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 337](https://github.com/heidrun-org/heidrun/issues/337), [issue 610](https://github.com/heidrun-org/heidrun/issues/610), [issue 617](https://github.com/heidrun-org/heidrun/issues/617), [issue 618](https://github.com/heidrun-org/heidrun/issues/618), [issue 656](https://github.com/heidrun-org/heidrun/issues/656), [issue 799](https://github.com/heidrun-org/heidrun/issues/799), [issue 826](https://github.com/heidrun-org/heidrun/issues/826), [issue 843](https://github.com/heidrun-org/heidrun_code/issues/843)

This file lists the files and the subfolders of this folder, for agents and tools.

- [README.md](README.md): the overview of this folder, for people.
- [glossary/](glossary/index.md): the glossary, split by topic: the definition of each word that the project uses for a part of the application, the official name "coding agent", and the official names of the project (Heidrun Organization, Heidrun Code, and Heidrun Notebook). Read the files that match the part that you change, before you change the code.
- [data_layer_operation_log.md](data_layer_operation_log.md): the rule that every public function of a data layer package and of `heidrun_data` is recorded in the operation log, what the log never does, the measure, and the replay. Read it each time that you add or change an operation of a data layer package or of `heidrun_data`.
- [application_log.md](application_log.md): the application log of Heidrun Code, its file, and its events (the calls to `gh` and `glab`, and the voice input). Read it when you add a call to `gh` or `glab`, or a step that takes time, and when the developer asks to read the log.
- [github_and_gitlab_support.md](github_and_gitlab_support.md): the rule that every support added for GitHub is also added for GitLab, and the matching `gh` and `glab` commands, and the one cached way that the application reads GitHub and GitLab. Read it each time that you add or change a support for GitHub, a read of GitHub or GitLab in the application, or a `gh` command in a document.
- [data_layer_access.md](data_layer_access.md): the rule that the Past chats sidebar section and the Statistics window get all their data through the packages of the data layer, the table of the commands, the exceptions, the check, and the audit of the bypasses. Read it each time that you change the Past chats sidebar section, the Statistics window, or a package of the data layer.
- [test_levels.md](test_levels.md): the rule of the fast tests, the slow tests, and the full tests: the four test commands, which test is slow, and how to add a test. Read it each time that you add or change a test command, add a slow test, or add a package that has tests.
- [user_interface/](user_interface/index.md): the rules of the user interface, split by topic. Each file starts with the part that it covers, and the appearance of each part is in the folder `web_styling`.
- [web_styling/](web_styling/index.md): the rules of the appearance of the web page: colors, buttons and their states, hover, contrast, icons, spacing, scroll bars, and the allowed utility classes, with the test of each rule. Read it before a change to the colors, the buttons, the hover, the spacing, or the icons of the web page.
