<div align="center">

<img src="data/images/heidrun_splash_screen.png" alt="The goat Heiðrún on top of Valhalla, pouring mead into a cauldron" width="720">

<!-- identity:start -->
<!-- Generated from data/identity.json: pnpm docs:identity -->

# Heidrun Code

### With AI, every developer is THE GOAT!

**Keep your agents working. Know which one needs you.**

<!-- identity:end -->

[![License: MIT](https://img.shields.io/github/license/heidrun-org/heidrun_code?color=blue)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS-black?logo=apple)](https://github.com/heidrun-org/heidrun_code)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![Rust](https://img.shields.io/badge/backend-Rust-DEA584?logo=rust&logoColor=black)](packages/apps/desktop_tauri)
[![Vue 3](https://img.shields.io/badge/frontend-Vue%203-4FC08D?logo=vuedotjs&logoColor=white)](packages/apps/web_frontend)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](packages/apps/web_frontend)
[![Issues](https://img.shields.io/github/issues/heidrun-org/heidrun_code)](https://github.com/heidrun-org/heidrun_code/issues)
[![Last commit](https://img.shields.io/github/last-commit/heidrun-org/heidrun_code)](https://github.com/heidrun-org/heidrun_code/commits)
[![Mead: unlimited](https://img.shields.io/badge/mead-unlimited-f5b700)](https://heidrun-org.github.io/heidrun_code/about)

[**Enter Valhalla (read the documentation)**](https://heidrun-org.github.io/heidrun_code/documentation/) · [Who is Heiðrún?](https://heidrun-org.github.io/heidrun_code/about) · [Report a Ragnarök](https://github.com/heidrun-org/heidrun_code/issues)

</div>

---

## What it does

You run many coding agents. Each coding agent wants a decision, a permission, or a code review, and each one waits in a different terminal. Heidrun Code puts all of them in one window, and tells you which one needs you right now.

Think of Valhalla: the coding agents are the einherjar (the warriors who feast and fight all day), and you are the goat who keeps the mead flowing.

## Why you will like it

- **One work window.** A tab bar above the panes, the workspace selector in the status bar, and a "Needs you" queue of blocked or finished agents in the right sidebar.
- **Real terminals.** Every pane shows the real Herdr terminal, so Claude Code, Codex, and all the colors look exactly as in Herdr.
- **Macros.** One click writes a ready text into a pane. The agents never wait for a developer who is typing.
- **Inspector.** Allow or deny an agent request in one click, read the context of the agent, and ask another agent to fix a problem.
- **Quotas in view.** The status bar shows your Claude and Codex quotas. The mead never runs out by surprise.
- **Command palette.** Press <kbd>⌘</kbd><kbd>K</kbd> for every action. A real Viking does not use the mouse.
- **Phone access.** Answer a blocked agent from your phone, through an ngrok tunnel. Valhalla fits in a pocket.
- **Safe by default.** Dangerous commands ask for confirmation before they run. Even a berserker needs a second thought.

The full list of features, shortcuts, and settings is in the [documentation](https://heidrun-org.github.io/heidrun_code/documentation/).

## Blog posts

Read the three-part series about developing software with Heidrun Code. These posts are drafts:

1. [Three Features in Progress. Which One Needs Me?](docs/blog_posts/three-features.blog_post.md)
2. [Why Did We Write This Code? Ask the Development History](docs/blog_posts/development-history.blog_post.md)
3. [What Does a Day of Development With Coding Agents Actually Look Like?](docs/blog_posts/day-of-development.blog_post.md)

## Installation

First install [Herdr](https://herdr.dev) 0.9 or later. Heidrun Code needs it, and does not install it:

```sh
curl -fsSL https://herdr.dev/install.sh | sh
```

The program ngrok is optional: only the mobile access uses it. Install it only if you want to answer your coding agents from your phone, with `brew install ngrok`. Then create a free account at ngrok.com, and run `ngrok config add-authtoken` followed by your token.

When a program is missing, Heidrun Code says so at the start, with the command that installs it.

Then, on a Mac with Apple silicon, run this command in a terminal. It installs the latest Heidrun Code in `/Applications`, and macOS opens Heidrun Code with no message "damaged". Quit Heidrun Code before you run it.

```sh
curl -fsSL https://raw.githubusercontent.com/heidrun-org/heidrun_code/main/scripts/install.sh | sh
```

The script [`scripts/install.sh`](scripts/install.sh) downloads the disk image of the latest release with `curl`, copies Heidrun Code to `/Applications`, and prints the installed version. Heidrun Code is not signed and not notarized, and `curl` does not put the quarantine mark on the disk image that it downloads, so macOS does not check the signature.

## Quick start

You need [Herdr](https://herdr.dev) 0.9 or later, Rust stable, Node.js 20 or later, and [pnpm](https://pnpm.io).

```sh
git clone --recurse-submodules git@github.com:heidrun-org/heidrun_code.git
cd heidrun
pnpm install
pnpm dev
```

After pulling changes, run `git submodule update --init --recursive` to check out the recorded submodule commits. The independent [coding agent skills repository](https://github.com/jeromeetienne/coding_agent_plugin) is included at [`submodules/coding_agent_plugin`](submodules/coding_agent_plugin).

To build the application, run `pnpm build`, then drag `Heidrun Code.app` into `/Applications`.

## What is in this repository

| Package | What it is |
| --- | --- |
| [`packages/apps/desktop_tauri`](packages/apps/desktop_tauri) | The macOS application: the Rust backend and the Tauri shell. |
| [`packages/apps/web_frontend`](packages/apps/web_frontend) | The user interface, written with Vue 3 and TypeScript. |
| [`packages/auxiliary/website_public`](packages/auxiliary/website_public) | The public website and documentation, built with VitePress. |
| [`packages/dev_tools/change_log_generator`](packages/dev_tools/change_log_generator) | A command line tool that writes `CHANGELOG.md` from the merged pull requests. |
| [`packages/dev_tools/install_script_tests`](packages/dev_tools/install_script_tests) | The tests of the script `scripts/install.sh`, which runs it with a fake `curl`, a fake `hdiutil`, and a fake `ditto`. |
| [`packages/dev_tools/worktree_tools`](packages/dev_tools/worktree_tools) | Two command line tools: one creates a Git worktree and clones the compiled Rust files into it, the other deletes the old Cargo target folders of the worktrees. |
| [`packages/auxiliary/coding_agent_cli`](packages/auxiliary/coding_agent_cli) | A Rust library and a command line tool that send one prompt to `codex`, `claude`, or `agy` and return the answer. The desktop application uses the library, and the change log generator runs the command line tool. |
| [`submodules/heidrun_data/packages/data_layer_code_hosting`](submodules/heidrun_data/packages/data_layer_code_hosting) | A Rust library and a command line tool that read the issues and the pull requests of a GitHub repository into two tables of a SQLite file (`initialize`, `update`), and run read-only SQL queries on them (`query`). |
| [`submodules/heidrun_data/packages/data_layer_source_control`](submodules/heidrun_data/packages/data_layer_source_control) | A Rust library and a command line tool that read the commits and the merges of a Git repository into a table of a SQLite file (`initialize`, `update`), and run read-only SQL queries on it (`query`). |
| [`submodules/heidrun_data/packages/data_layer_user_activity`](submodules/heidrun_data/packages/data_layer_user_activity) | A Rust library and a command line tool that read the user activity records of the developer from the file `user_activity.jsonl` into a table of a SQLite file (`initialize`, `update`), and run read-only SQL queries on it (`query`). |
| [`submodules/heidrun_data/packages/data_layer_coding_agents`](submodules/heidrun_data/packages/data_layer_coding_agents) | A Rust library and a command line tool that read the chat sessions of Claude Code and of Codex for a repository into a SQLite file (`initialize`, `update`), and run read-only SQL queries on them (`query`). The desktop application uses the library to list its chats. |

## Contributing

Read [`AGENTS.md`](AGENTS.md) for the rules of this repository, then open an [issue](https://github.com/heidrun-org/heidrun_code/issues) before you start a change.

## License

[MIT](LICENSE). Skål! 🍻
