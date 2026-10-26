# coding_agent_cli

A Rust library and a command line tool for [Heidrun Code](../../../README.md). Both send one prompt to a coding agent command line tool (`codex`, `claude`, or `agy`), wait for the answer, and return the answer as text. The desktop application uses the library, and the change log generator runs the command line tool. The name `coding_agent_cli` is the name of the package and the name of the executable.

## What it contains

- `src/lib.rs`: the public interface of the library.
- `src/ask.rs`: the function `ask`, which sends one prompt to a coding agent.
- `src/run_tool.rs`: the function `run_tool`, which runs a tool with arguments and gives what it printed, for example the list of the models of a coding agent.
- `src/agent_shell.rs`: the type `AgentShell`, the shell that starts a tool.
- `src/main.rs` and `src/command_line.rs`: the command line. It is the executable `coding_agent_cli`.
- `tests/`: the tests of the executable. They use fake `codex` and `claude` commands.

## Command line

Run the command from the root of the repository. The option `--silent` of `pnpm` removes the lines that `pnpm` prints before the answer. The first run builds the executable, which takes some time. The command runs in the folder of the package, so give a prompt file with an absolute path.

```sh
pnpm --silent --filter coding_agent_cli cli "Write one sentence that explains a change log."
pnpm --silent --filter coding_agent_cli cli --agent claude "Write one sentence about Git."
pnpm --silent --filter coding_agent_cli cli --prompt-file /path/to/prompt.md
git log --oneline -20 | pnpm --silent --filter coding_agent_cli cli "Summarize these commits:"
```

```text
Usage: coding_agent_cli [options] [prompt]

Sends one prompt to a coding agent (codex, claude, or agy), waits for the answer,
and prints the answer on the standard output.

Arguments:
  prompt                    A short prompt, written directly on the command
                            line. Put it in quotes. If the standard input has
                            text, the command adds it after the prompt, with a
                            blank line between them.

Options:
  -a, --agent <name>        The coding agent to run: "codex" runs "codex exec",
                            "claude" runs "claude -p", "agy" runs "agy -p".
                            (choices: "codex", "claude", "agy", default: "codex")
  -f, --prompt-file <path>  Read a long prompt from a file, in place of the
                            argument.
  -v, --version             Print the version number.
  -h, --help                Print this help.

Exit codes:
  0   The coding agent answered. The answer is on the standard output.
  1   An error happened. The message is on the standard error output.
```

- The default coding agent is `codex`.
- You give the prompt as an argument or with `--prompt-file`, not both. If you give both, the command exits with code 1.
- If the standard input has text, the command adds the text after the prompt, with a blank line between them. If you give no prompt and the standard input is empty, the command exits with code 1.

## Library

The package `desktop_tauri` uses the library with a path dependency in its file `Cargo.toml`.

```rust
use coding_agent_cli::{ask, AgentShell};

let answer = ask(&AgentShell::login(), Some("codex"), "Write one sentence that explains a change log.", None, None).await?;
println!("{}", answer.text);
```

The function `ask` takes these arguments.

| Argument | Meaning |
| --- | --- |
| `shell` | The `AgentShell` that starts the tool: `AgentShell::login()` for the login shell of the developer, `AgentShell::plain()` for a plain shell. |
| `agent` | `Some("codex")` runs `codex exec --skip-git-repo-check -`. `Some("claude")` runs `claude -p`. `Some("agy")` runs `agy -p` with the prompt as the value of the option. `None` runs the first of `codex` and `claude` that exists, and gives the error `no_coding_agent` when none exists: `agy` is never chosen alone. |
| `prompt` | The text to send to the coding agent. |
| `folder` | The folder where the coding agent runs. The function makes it when it does not exist. `None` keeps the folder of the program. |
| `timeout` | How long the function waits for the answer, in seconds. `None` waits without end. |

The function sends the prompt through the standard input, so a long prompt does not reach the size limit of the command line. The one exception is `agy`: its option `-p` needs the prompt as an argument, so a prompt larger than the limit of the command line gives the error "Argument list too long". The function returns the name of the coding agent and the text that the coding agent printed on the standard output, without the spaces and the line breaks at the start and at the end.

The function gives an error in these cases:

- The coding agent name is not `codex`, `claude`, or `agy`.
- The command is not installed, or is not in the `PATH`.
- The command exits with an error code. The error is the first line that the command printed on its standard error output.
- The command does not answer in the time of `timeout`.

The function `run_tool` runs a tool with arguments and gives its standard output. The desktop application uses it to read the list of the models of a coding agent.

## Limits

- Each call is one prompt and one answer. The package keeps no conversation.
- The package does not install `codex`, `claude`, or `agy`. You must install them and sign in before you use the package.

## Commands

Run this command from the root of the repository.

```sh
pnpm --filter coding_agent_cli test   # run the Rust tests with cargo test
```
