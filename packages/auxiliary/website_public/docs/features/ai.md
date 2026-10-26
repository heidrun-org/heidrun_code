---
description: "What Heidrun Code sends to a language model, when it sends it, what stays on your computer, and how to switch it off."
---

# The use of AI

You want to know what a tool sends to a language model before you give it your code.

## What Heidrun Code does

Heidrun Code has no language model and no server of its own. When a feature needs a language model, Heidrun Code asks the coding agent that is already installed on your computer: `codex` when it is installed, `claude` otherwise. The request goes to the provider of that coding agent, with your own account, like any prompt that you type yourself. When no coding agent is installed, Heidrun Code makes no call.

## Where Heidrun Code uses a language model

Four features use a language model:

| Feature | When Heidrun Code makes a call | What Heidrun Code sends | Default |
| --- | --- | --- | --- |
| Dynamic topics, method "Language model", in the Past chats sidebar section | When a chat of the list has no dynamic topic, or has new messages | The title of each chat, and the first messages that you typed. Never the messages of the coding agent, the files, the issues, or the pull requests | Off: the method "Keyword" is the default |
| Clustered dynamic topics, in the Past chats sidebar section | When a new dynamic topic appears | Only the short labels of the dynamic topics. Never the text of a chat | Off |
| The commit message, in the Source control sidebar section | Only when you click the sparkle button "Write the commit message with a coding agent" | The diff of the staged files, or of every change when no file is staged | Only on a click |
| The name and the description of a custom launcher, in the Launchers sidebar section | Only when you click the button "Write the empty fields (name, description) with a coding agent" | What you wrote in the window: the command line, or the prompt of the coding agent | Only on a click |

## What stays on your computer

- The method "Keyword" of the dynamic topics finds the dynamic topics on your computer, with no language model. It reads the titles of the issues and of the pull requests on GitHub or GitLab, with the command `gh` or `glab`.
- The summary of each chat, its tokens, and its estimated cost come from the files of the chat, with no language model. Heidrun Code downloads the public price list of the project LiteLLM once a day, and sends nothing with the download.
- The Statistics window counts facts with fixed rules, and never uses a language model.

## How to switch it off

In the section "Dynamic topics" of the Settings window:

- Keep the method "Keyword", or switch off "Enable dynamic topics".
- Keep "Enable clustered dynamic topics" off.

The commit message and the custom launcher use a language model only when you click their button.

*Heidrun Code asks your own einherjar for help, and never a stranger from outside Valhalla.*
