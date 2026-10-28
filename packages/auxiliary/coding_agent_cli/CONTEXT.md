# Directory Context: `/packages/auxiliary/coding_agent_cli`

## Purpose
A Rust library and a command line tool that send one prompt to a coding agent command line tool (`codex`, `claude`, or `agy`), wait for the answer, and return the answer as text. The desktop application uses the library, and the change log generator runs the command line tool. The name `coding_agent_cli` is the name of the package and the name of the executable.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `ask`, `run_tool`, `AgentShell`, `login_shell`, `coding_agent_names`, `Answer`, `CODING_AGENTS`, `DEFAULT_CODING_AGENTS`, and `NO_CODING_AGENT`.
- `src/main.rs`: the command line, and the executable `coding_agent_cli`. The module `src/command_line.rs` reads its arguments.
- `tests/`: the tests of the executable, with fake `codex`, `claude`, and `agy` commands put at the start of the PATH. The tests of the library sit at the end of each source file.
- Command to run this folder: `pnpm --silent --filter coding_agent_cli cli --help`
- Command to test this folder: `pnpm --filter coding_agent_cli test`

## Rules
- `claude` runs as `claude -p`, `codex` runs as `codex exec --skip-git-repo-check -`, and `agy` runs as `agy -p <prompt>`. These arguments are written only in `src/ask.rs`. The function `ask_light` runs a light call for a short labelling job in the background: `claude -p --model haiku --effort low --tools "" --no-session-persistence` and `codex exec --skip-git-repo-check --ephemeral -c model_reasoning_effort="low" -`, so the call is cheaper and leaves no chat in the history of the coding agent ([issue 269](https://github.com/heidrun-org/heidrun_code/issues/269)).
- The prompt goes through the standard input of the coding agent, so a long prompt does not reach the size limit of the command line. The one exception is `agy`: its option `-p` takes the prompt as its value, and `-p -` sends the text `-` and not the standard input (tested with `agy` 1.3.4). A prompt larger than the limit of the command line gives the error "Argument list too long" for `agy`.
- A call goes through an `AgentShell`. The desktop application gives the login shell (`AgentShell::login`), because an application that starts from the Finder does not have the PATH of a terminal. The command line gives a plain shell (`AgentShell::plain`), because a terminal already has the right PATH.
- `ask` without a coding agent name runs the first of `DEFAULT_CODING_AGENTS` (`codex`, then `claude`) that exists, and gives the error `no_coding_agent` when none exists. `agy` is never chosen alone: only a caller that names it runs it, because the texts of the desktop application say "codex or claude". The web frontend of the desktop application tests the exact text of the error.
- The command line uses `codex` when the option `--agent` is missing. It prints the answer on the standard output, prints an error message on the standard error output, and exits with code 1 when an error happens.
- The library keeps no conversation: one call is one prompt and one answer.
- This package knows nothing about Tauri and imports nothing from another package of the workspace. The Tauri commands stay in `packages/apps/desktop_tauri`.
- The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`, so the folder that `pnpm worktree:create` clones is the only one. Cargo reads this file only when it runs inside this folder.

## Background
- The package was created by [issue #113](https://github.com/heidrun-org/heidrun/issues/113) in TypeScript. [Issue #265](https://github.com/heidrun-org/heidrun/issues/265) wrote the same rules again in Rust for the desktop application.
- [Issue #394](https://github.com/heidrun-org/heidrun/issues/394) replaced both by this Rust package, so each new coding agent needs one change. `agy` is the coding agent of [issue #390](https://github.com/heidrun-org/heidrun/issues/390).
- `codex exec` refuses to run outside a trusted Git repository without `--skip-git-repo-check`, so the package always passes the flag.
