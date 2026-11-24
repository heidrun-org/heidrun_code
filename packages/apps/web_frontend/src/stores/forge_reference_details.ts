// The live reader of an issue or of a pull request: it runs `gh` or `glab` through `runForgeCli`, which keeps each answer
// on the disk for ten minutes.
//
// The live callers are:
// - the Code hosting sidebar section and terminal reference cards;
// - the Past chats sidebar section on GitLab, because the package `data_layer_code_hosting` reads GitHub only (issue 455).
// The Past chats sidebar section on GitHub, and the Statistics window, never use this file.
import { runForgeCli } from "../lib/forge_cli";
import { chatReferenceTimeOf, githubAvatarUrl, type ChatReference } from "../lib/chat_references";
import type { Forge, RefTarget } from "../lib/refs";
import type { ChatReferenceDetails } from "./chat_references";

/** The resolved item and details displayed by a terminal reference card. */
type TerminalReferenceDetails = {
	/** The item after GitHub resolves a shared issue and pull request number. */
	reference: ChatReference;
	/** The heading, state, and description of the item. */
	details: (ChatReferenceDetails & { url?: string }) | null;
};

/** Reads the live reference details used by the terminal and the Code hosting sidebar section. */
export class ForgeReferenceDetails {
	/**
	 * Resolves a terminal reference using its own repository and reads its card.
	 * @param folder - The workspace folder.
	 * @param forge - The hosting service.
	 * @param webBase - The address of the referenced repository.
	 * @param reference - The item derived from the terminal text.
	 * @param target - The parsed reference target.
	 * @returns The canonical item and the details to show on the card.
	 */
	static async loadTerminalReference(
		folder: string, forge: Forge, webBase: string, reference: ChatReference, target: RefTarget,
	): Promise<TerminalReferenceDetails> {
		const lookup = {
			...target,
			project: target.project ?? new URL(webBase).pathname.slice(1),
		};
		const details = await loadForgeReferenceDetails(folder, forge, reference, lookup);
		if (forge === 'github' && reference.kind === 'issue' && details?.url !== undefined &&
			/\/pull\/\d+\/?$/.test(new URL(details.url).pathname)) {
			const pullRequest: ChatReference = {
				...reference,
				kind: 'pull_request',
				url: details.url,
			};
			return {
				reference: pullRequest,
				details: await loadForgeReferenceDetails(folder, forge, pullRequest, lookup) ?? details,
			};
		}
		return {
			reference: details?.url === undefined ? reference : { ...reference, url: details.url },
			details,
		};
	}
}

/**
 * The details of an issue or of a pull request, read live.
 * @param folder - the folder of the workspace, where `gh` or `glab` runs
 * @param forge - the forge of the repository
 * @param reference - the issue or the pull request
 * @param target - the explicit repository, if the terminal link names one
 * @returns the details, or null when the forge does not answer
 */
export async function loadForgeReferenceDetails(
  folder: string,
  forge: Forge,
  reference: ChatReference,
  target?: RefTarget,
): Promise<(ChatReferenceDetails & { url?: string }) | null> {
  try {
    return forge === "github" ? await readGithub(folder, reference, target) : await readGitlab(folder, reference, target);
  } catch {
    return null;
  }
}

/** The details of an issue or of a pull request, read with `gh`. */
async function readGithub(folder: string, reference: ChatReference, target?: RefTarget): Promise<ChatReferenceDetails & { url?: string }> {
  const isIssue = reference.kind === "issue";
  let fields = isIssue
    ? "title,state,body,labels,author,createdAt"
    : "title,state,body,labels,author,createdAt,headRefName,baseRefName";
  if (target !== undefined) {
    fields += ",url";
  }
  const args = [isIssue ? "issue" : "pr", "view", String(reference.number), "--json", fields];
  if (target?.project !== undefined && reference.url !== null) {
    args.push("--repo", `${new URL(reference.url).hostname}/${target.project}`);
  }
  const answer = JSON.parse(await runForgeCli("reference_card", folder, "gh", args)) as {
    title: string;
    url?: string;
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
    ...(answer.url === undefined ? {} : { url: answer.url }),
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
async function readGitlab(folder: string, reference: ChatReference, target?: RefTarget): Promise<ChatReferenceDetails & { url?: string }> {
  const kind = reference.kind === "issue" ? "issues" : "merge_requests";
  const project = target?.project === undefined ? ":fullpath" : encodeURIComponent(target.project);
  const args = ["api", `projects/${project}/${kind}/${reference.number}`];
  if (target?.project !== undefined && reference.url !== null) {
    args.push("--hostname", new URL(reference.url).hostname);
  }
  const answer = JSON.parse(await runForgeCli("reference_card", folder, "glab", args)) as {
    title: string;
    web_url?: string;
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
    ...(target === undefined || answer.web_url === undefined ? {} : { url: answer.web_url }),
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
