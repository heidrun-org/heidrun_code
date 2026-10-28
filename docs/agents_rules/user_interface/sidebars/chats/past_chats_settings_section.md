# Past chats sidebar section: the heading "Past chats" of the section "Sidebars" of the Settings window

- Created: 14 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../../glossary/index.md), [chats_list.md](chats_list.md)
- Related issue: [issue 442](https://github.com/heidrun-org/heidrun/issues/442), [issue 556](https://github.com/heidrun-org/heidrun/issues/556)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../../glossary/index.md).

- The Settings window has a section "Sidebars", with one heading for each sidebar section: "Needs you", "Past chats", and "Source control" ([needs_you_workspaces.md](../needs_you_workspaces.md)). The section "Sidebars" sits in the sidebar of the Settings window just before the section "Dynamic topics".
- Under the heading "Past chats", the section holds one choice, "Read the chats again every": a Bootstrap 6 button group of four radio inputs (`btn-group` with `btn-check btn-outline theme-secondary` labels), "5 seconds", "10 seconds", "30 seconds", and "1 minute". The choice is the option `chatsRefreshSeconds` of the settings, in seconds, and the default is 10, so the behavior does not change for the developers who already use Heidrun Code. A saved value that is not one of the four choices gives the default value back.
- Under the button group, a help paragraph (`form-text`) says that, while the Past chats sidebar section is on the screen, Heidrun Code reads the files of the chats again after this delay, so that the numbers of a chat that is still running stay true, and that a shorter delay shows the changes sooner.
- The Past chats sidebar section reads the chats again after this delay, while it is on the screen. A change of the choice starts the count again at once, without a new start of Heidrun Code. The synchronizations are cheap: the package `data_layer_coding_agents` reads again only the lines that the coding agent added to a file, as [chat_summary.md](chat_summary.md) says.
