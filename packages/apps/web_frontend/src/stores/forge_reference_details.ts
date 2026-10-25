// The live reader of an issue or of a pull request: it runs `gh` or `glab` through `runForgeCli`, which keeps each answer
// on the disk for ten minutes.
//
// Two places use it, and both are allowed by docs/agents_rules/data_layer_access.md:
// - the Code hosting sidebar section, whose lists are live on purpose;
// - the Past chats sidebar section on GitLab, because the package `data_layer_code_hosting` reads GitHub only (issue 455).
// The Past chats sidebar section on GitHub, and the Statistics window, never use this file.
import { runForgeCli } from "../lib/forge_cli";
import { chatReferenceTimeOf, githubAvatarUrl, type ChatReference } from "../lib/chat_references";
import type { Forge } from "../lib/refs";
import type { ChatReferenceDetails } from "./chat_references";

/**
 * The details of an issue or of a pull request, read live.
 * @param folder - the folder of the workspace, where `gh` or `glab` runs
 * @param forge - the forge of the repository
 * @param reference - the issue or the pull request
 * @returns the details, or null when the forge does not answer
 */
export async function loadForgeReferenceDetails(
  folder: string,
  forge: Forge,
  reference: ChatReference,
): Promise<ChatReferenceDetails | null> {
  try {
    return forge === "github" ? await readGithub(folder, reference) : await readGitlab(folder, reference);
  } catch {
    return null;
  }
}

/** The details of an issue or of a pull request, read with `gh`. */
async function readGithub(folder: string, reference: ChatReference): Promise<ChatReferenceDetails> {
  const isIssue = reference.kind === "issue";
  const fields = isIssue
    ? "title,state,body,labels,author,createdAt"
    : "title,state,body,labels,author,createdAt,headRefName,baseRefName";
  const args = [isIssue ? "issue" : "pr", "view", String(reference.number), "--json", fields];
  const answer = JSON.parse(await runForgeCli(folder, "gh", args)) as {
    title: string;
    state: string;
    body?: string;
    labels?: { name: string; color?: string }[];
    author?: { login?: string };
    createdAt?: string;
    headRefName?: string;
    baseRefName?: string;
  };
  return {
    title: answer.title,
    rawState: answer.state.toLowerCase(),
    body: answer.body ?? "",
    labels: (answer.labels ?? []).map((label) => ({ name: label.name, color: label.color ?? null })),
    author: answer.author?.login ?? null,
    authorAvatarUrl: githubAvatarUrl(answer.author?.login),
    createdAt: chatReferenceTimeOf(answer.createdAt),
    headBranch: answer.headRefName ?? null,
    baseBranch: answer.baseRefName ?? null,
  };
}

/** The details of an issue or of a merge request, read with `glab`. */
async function readGitlab(folder: string, reference: ChatReference): Promise<ChatReferenceDetails> {
  const kind = reference.kind === "issue" ? "issues" : "merge_requests";
  const args = ["api", `projects/:fullpath/${kind}/${reference.number}`];
  const answer = JSON.parse(await runForgeCli(folder, "glab", args)) as {
    title: string;
    state: string;
    description?: string | null;
    labels?: string[];
    author?: { username?: string; avatar_url?: string };
    created_at?: string;
    source_branch?: string;
    target_branch?: string;
  };
  return {
    title: answer.title,
    rawState: answer.state === "opened" ? "open" : answer.state,
    body: answer.description ?? "",
    labels: (answer.labels ?? []).map((name) => ({ name, color: null })),
    author: answer.author?.username ?? null,
    authorAvatarUrl: /^https?:\/\//.test(answer.author?.avatar_url ?? "") ? (answer.author?.avatar_url ?? null) : null,
    createdAt: chatReferenceTimeOf(answer.created_at),
    headBranch: answer.source_branch ?? null,
    baseBranch: answer.target_branch ?? null,
  };
}
