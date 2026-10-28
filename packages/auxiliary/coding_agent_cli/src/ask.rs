//! Sends one prompt to a coding agent command line tool, and gives the answer.

use crate::agent_shell::AgentShell;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncWriteExt;

/// The coding agents that a caller can name. The name of a coding agent is also the name of its command.
pub const CODING_AGENTS: [&str; 3] = ["codex", "claude", "agy"];

/// The coding agents that `ask` tries, the one that is tried first coming first, when the caller names none. `agy` is not
/// here: only a caller that names it runs it.
pub const DEFAULT_CODING_AGENTS: [&str; 2] = ["codex", "claude"];

/// The error that `ask` gives when no coding agent is named, and none of `DEFAULT_CODING_AGENTS` is installed.
pub const NO_CODING_AGENT: &str = "no_coding_agent";

/// The answer of a coding agent.
#[derive(Debug, PartialEq)]
pub struct Answer {
    /// The coding agent that answered: `codex` or `claude`.
    pub agent: String,
    /// What the coding agent printed, without the spaces and the line breaks at its start and at its end.
    pub text: String,
}

/// How to run one coding agent with one prompt.
struct Invocation {
    /// The arguments of the command.
    arguments: Vec<String>,
    /// What to write on the standard input of the command, or `None` when the command takes the prompt in its arguments.
    standard_input: Option<Vec<u8>>,
}

/// How to run `agent` with `prompt`. `claude` and `codex` read the prompt on their standard input. `agy` does not: its option
/// `-p` takes the prompt as its value, and `-p -` would send the text `-`. `codex exec` refuses to run outside a trusted Git
/// repository without `--skip-git-repo-check`, so the flag is always given.
///
/// A light call is a short labelling job that runs in the background. `claude` runs with the small model `haiku`, a low
/// effort, no tool, and no saved chat: one call cost 0.0026 dollar instead of 0.16 dollar with the default model (issue
/// 269). `codex` runs with a low effort and no saved chat, with its default model, because a model name of `codex` can be
/// missing from the plan of the developer. `agy` has no such options and runs as for a normal call.
fn invocation_of(agent: &str, prompt: &str, is_light: bool) -> Invocation {
    let words = |words: &[&str]| words.iter().map(|word| word.to_string()).collect::<Vec<String>>();
    match (agent, is_light) {
        ("claude", false) => Invocation { arguments: words(&["-p"]), standard_input: Some(prompt.as_bytes().to_vec()) },
        ("claude", true) => Invocation {
            arguments: words(&["-p", "--model", "haiku", "--effort", "low", "--tools", "", "--no-session-persistence"]),
            standard_input: Some(prompt.as_bytes().to_vec()),
        },
        ("agy", _) => Invocation { arguments: vec!["-p".to_string(), prompt.to_string()], standard_input: None },
        (_, false) => Invocation { arguments: words(&["exec", "--skip-git-repo-check", "-"]), standard_input: Some(prompt.as_bytes().to_vec()) },
        (_, true) => Invocation {
            arguments: words(&["exec", "--skip-git-repo-check", "--ephemeral", "-c", "model_reasoning_effort=\"low\"", "-"]),
            standard_input: Some(prompt.as_bytes().to_vec()),
        },
    }
}

/// The names of `CODING_AGENTS` as a sentence: `codex, claude or agy`.
pub fn coding_agent_names() -> String {
    let (last, first) = CODING_AGENTS.split_last().unwrap();
    format!("{} or {last}", first.join(", "))
}

/// The coding agent to run: the one that `agent` names, or the first of `DEFAULT_CODING_AGENTS` that exists when `agent` is
/// `None`.
async fn choose(shell: &AgentShell, agent: Option<&str>) -> Result<&'static str, String> {
    let Some(name) = agent else {
        for candidate in DEFAULT_CODING_AGENTS {
            if shell.has(candidate).await {
                return Ok(candidate);
            }
        }
        return Err(NO_CODING_AGENT.to_string());
    };
    let Some(known) = CODING_AGENTS.into_iter().find(|candidate| *candidate == name) else {
        return Err(format!("Unknown coding agent \"{name}\". Use {}.", coding_agent_names()));
    };
    if shell.has(known).await {
        Ok(known)
    } else {
        Err(format!("The command \"{known}\" is not installed or is not in the PATH."))
    }
}

/// Sends `prompt` to a coding agent and returns the answer. The prompt goes through the standard input, so a long prompt
/// does not reach the size limit of the command line. The one exception is `agy`: it takes the prompt in its arguments, so
/// a prompt larger than the limit of the command line gives the error "Argument list too long".
///
/// - `agent` names the coding agent to run. `None` runs the first of `DEFAULT_CODING_AGENTS` that exists, and gives the
///   error `NO_CODING_AGENT` when none exists.
/// - `folder` is the folder where the coding agent runs. The call makes it when it does not exist. `None` keeps the folder
///   of the program. A folder that is not a workspace of the developer keeps the chat of the coding agent out of the Chats
///   sidebar section.
/// - `timeout` is how long the call waits for the answer, in seconds. `None` waits without end.
///
/// The error is the first line that the command printed on its standard error output, or the reason why it did not run.
pub async fn ask(
    shell: &AgentShell,
    agent: Option<&str>,
    prompt: &str,
    folder: Option<&Path>,
    timeout: Option<u64>,
) -> Result<Answer, String> {
    ask_with(shell, agent, prompt, folder, timeout, false).await
}

/// Sends `prompt` to a coding agent as a light call: a short labelling job that runs in the background, on a cheaper model
/// when the coding agent allows it, and that leaves no chat in the history of the coding agent. The arguments and the
/// answer are the ones of `ask`.
pub async fn ask_light(
    shell: &AgentShell,
    agent: Option<&str>,
    prompt: &str,
    folder: Option<&Path>,
    timeout: Option<u64>,
) -> Result<Answer, String> {
    ask_with(shell, agent, prompt, folder, timeout, true).await
}

/// Runs `ask` or `ask_light`: `is_light` chooses the arguments of the light call.
async fn ask_with(
    shell: &AgentShell,
    agent: Option<&str>,
    prompt: &str,
    folder: Option<&Path>,
    timeout: Option<u64>,
    is_light: bool,
) -> Result<Answer, String> {
    let agent = choose(shell, agent).await?;
    let invocation = invocation_of(agent, prompt, is_light);
    let mut command = shell.command("exec \"$0\" \"$@\"", &[]);
    command.arg(agent).args(&invocation.arguments);
    command.stdin(if invocation.standard_input.is_some() { Stdio::piped() } else { Stdio::null() });
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(folder) = folder {
        let _ = std::fs::create_dir_all(folder);
        command.current_dir(folder);
    }
    let mut child = command.spawn().map_err(|error| format!("{agent} : {error}"))?;
    let stdin = child.stdin.take();
    // The coding agent can exit before it reads the whole prompt: the exit code tells what happened.
    let write = async move {
        if let (Some(mut stdin), Some(bytes)) = (stdin, invocation.standard_input) {
            let _ = stdin.write_all(&bytes).await;
        }
    };
    let work = async { tokio::join!(write, child.wait_with_output()) };
    let (_, output) = match timeout {
        Some(seconds) => tokio::time::timeout(Duration::from_secs(seconds), work)
            .await
            .map_err(|_| format!("{agent} : no answer in {seconds} s"))?,
        None => work.await,
    };
    let output = output.map_err(|error| format!("{agent} : {error}"))?;
    if output.status.success() {
        return Ok(Answer { agent: agent.to_string(), text: String::from_utf8_lossy(&output.stdout).trim().to_string() });
    }
    let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if error.is_empty() { format!("{agent} failed ({})", output.status) } else { format!("{agent} : {error}") })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake_commands::{FakeCommands, ECHO_SCRIPT};

    #[tokio::test]
    async fn runs_a_light_call_of_codex_with_a_low_effort_and_no_saved_chat() {
        let fake = FakeCommands::new("light_codex", &[("codex", ECHO_SCRIPT)]);
        let answer = ask_light(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await.unwrap();
        assert_eq!(
            answer.text,
            "arguments:exec --skip-git-repo-check --ephemeral -c model_reasoning_effort=\"low\" -\nstandard input:the prompt"
        );
    }

    #[tokio::test]
    async fn runs_a_light_call_of_claude_with_haiku_no_tool_and_no_saved_chat() {
        let fake = FakeCommands::new("light_claude", &[("claude", ECHO_SCRIPT)]);
        let answer = ask_light(&fake.shell, Some("claude"), "the prompt", None, Some(20)).await.unwrap();
        assert_eq!(
            answer.text,
            "arguments:-p --model haiku --effort low --tools  --no-session-persistence\nstandard input:the prompt"
        );
    }

    #[tokio::test]
    async fn runs_codex_with_the_prompt_on_the_standard_input_when_both_exist() {
        let fake = FakeCommands::new("both", &[("codex", ECHO_SCRIPT), ("claude", "echo claude")]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await.unwrap();
        assert_eq!(answer.agent, "codex");
        assert_eq!(answer.text, "arguments:exec --skip-git-repo-check -\nstandard input:the prompt");
    }

    #[tokio::test]
    async fn runs_claude_when_codex_does_not_exist() {
        let fake = FakeCommands::new("claude_only", &[("claude", ECHO_SCRIPT)]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await.unwrap();
        assert_eq!(answer.agent, "claude");
        assert_eq!(answer.text, "arguments:-p\nstandard input:the prompt");
    }

    #[tokio::test]
    async fn runs_the_coding_agent_that_the_caller_names_even_when_the_other_one_comes_first() {
        let fake = FakeCommands::new("named", &[("codex", "echo codex"), ("claude", ECHO_SCRIPT)]);
        let answer = ask(&fake.shell, Some("claude"), "the prompt", None, Some(20)).await.unwrap();
        assert_eq!(answer, Answer { agent: "claude".into(), text: "arguments:-p\nstandard input:the prompt".into() });
    }

    #[tokio::test]
    async fn gives_the_prompt_to_agy_as_the_value_of_the_option_p_and_nothing_on_the_standard_input() {
        let fake = FakeCommands::new("agy", &[("agy", ECHO_SCRIPT)]);
        let answer = ask(&fake.shell, Some("agy"), "the prompt", None, Some(20)).await.unwrap();
        assert_eq!(answer, Answer { agent: "agy".into(), text: "arguments:-p the prompt\nstandard input:".into() });
    }

    #[tokio::test]
    async fn keeps_a_prompt_of_several_lines_and_quotes_in_one_argument_of_agy() {
        let fake = FakeCommands::new("agy_lines", &[("agy", "printf '%s' \"$2\"")]);
        let prompt = "line one\nit's \"two\" $HOME `date`";
        let answer = ask(&fake.shell, Some("agy"), prompt, None, Some(20)).await.unwrap();
        assert_eq!(answer.text, prompt);
    }

    #[tokio::test]
    async fn does_not_run_agy_when_the_caller_names_no_coding_agent() {
        let fake = FakeCommands::new("agy_not_default", &[("agy", "echo agy")]);
        let answer = ask(&fake.shell, None, "the prompt", None, Some(20)).await;
        assert_eq!(answer, Err("no_coding_agent".to_string()));
    }

    #[tokio::test]
    async fn gives_the_error_no_coding_agent_when_neither_exists() {
        let fake = FakeCommands::new("none", &[]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await;
        assert_eq!(answer, Err("no_coding_agent".to_string()));
    }

    #[tokio::test]
    async fn gives_a_clear_error_when_the_named_command_is_not_installed() {
        let fake = FakeCommands::new("not_installed", &[("codex", "echo codex")]);
        let answer = ask(&fake.shell, Some("claude"), "the prompt", None, Some(20)).await;
        assert_eq!(answer, Err("The command \"claude\" is not installed or is not in the PATH.".to_string()));
    }

    #[tokio::test]
    async fn gives_a_clear_error_when_the_coding_agent_is_not_known() {
        let fake = FakeCommands::new("unknown", &[("gemini", "echo gemini")]);
        let answer = ask(&fake.shell, Some("gemini"), "the prompt", None, Some(20)).await;
        assert_eq!(answer, Err("Unknown coding agent \"gemini\". Use codex, claude or agy.".to_string()));
    }

    #[tokio::test]
    async fn gives_the_standard_error_output_when_the_coding_agent_fails() {
        let fake = FakeCommands::new("failure", &[("codex", "echo 'not signed in' >&2\nexit 3")]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await;
        assert_eq!(answer, Err("codex : not signed in".to_string()));
    }

    #[tokio::test]
    async fn gives_the_exit_status_when_the_coding_agent_fails_without_a_message() {
        let fake = FakeCommands::new("silent_failure", &[("codex", "exit 3")]);
        let answer = ask(&fake.shell, None, "the prompt", None, Some(20)).await;
        assert!(matches!(&answer, Err(text) if text.starts_with("codex failed (")), "{answer:?}");
    }

    #[tokio::test]
    async fn gives_an_error_when_the_coding_agent_does_not_answer_in_time() {
        let fake = FakeCommands::new("slow", &[("codex", "sleep 5")]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(1)).await;
        assert_eq!(answer, Err("codex : no answer in 1 s".to_string()));
    }

    #[tokio::test]
    async fn waits_without_end_when_the_caller_gives_no_timeout() {
        let fake = FakeCommands::new("no_timeout", &[("codex", "sleep 1\necho late")]);
        let answer = ask(&fake.shell, None, "the prompt", None, None).await.unwrap();
        assert_eq!(answer.text, "late");
    }

    #[tokio::test]
    async fn runs_the_coding_agent_in_the_given_folder() {
        let fake = FakeCommands::new("folder", &[("codex", "pwd")]);
        let answer = ask(&fake.shell, None, "the prompt", Some(&fake.working_folder()), Some(20)).await.unwrap();
        assert!(answer.text.ends_with("work"), "{}", answer.text);
    }

    #[tokio::test]
    async fn sends_a_prompt_larger_than_the_limit_of_the_command_line() {
        let fake = FakeCommands::new("large", &[("claude", ECHO_SCRIPT)]);
        let prompt = "x".repeat(2_000_000);
        let answer = ask(&fake.shell, Some("claude"), &prompt, None, Some(60)).await.unwrap();
        assert_eq!(answer.text, format!("arguments:-p\nstandard input:{prompt}"));
    }
}
