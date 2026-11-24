// Issue, pull request, and merge request references in terminal output:
// found per screen line, then colored (decorations) and made clickable (link provider).
import { invoke } from "@tauri-apps/api/core";
import { DetectionPatterns } from "./detection_patterns";
import { parseReferences } from "./project_config";

export type RefKind = "issue" | "mr";
export type Forge = "github" | "gitlab";

/** An issue or request link found in the terminal buffer. */
export type RefMatch = {
  /** Start of the reference in the text. */
  start: number;
  /** End of the reference, exclusive. */
  end: number;
  /** The reference kind used to color the terminal text. */
  kind: RefKind;
  /** The web address of the item. */
  url: string;
  /** The repository and number used to load the information card. */
  target: RefTarget;
};

/** An issue or a merge request that the application previews itself. */
export interface RefTarget {
  type: "issue" | "mr";
  number: number;
  /** The repository named in a full address. Absent for shorthand references. */
  project?: string;
  /** The forge of the explicit repository, when the text tells it (a full address). Absent: the forge of the pane. */
  forge?: Forge;
}

export interface RefContext {
  /** Git root of the workspace, when available. */
  root?: string;
  /** Web URL of the repository, e.g. https://gitlab.com/group/app */
  base: string | null;
  /** Web origin, e.g. https://gitlab.com, used for full links to the configured host. */
  origin: string | null;
  forge: Forge | null;
  /** Ticket URL template with {key}, e.g. https://acme.atlassian.net/browse/{key} */
  ticketUrl: string | null;
  /** Restricts tickets to these prefixes (["ABC", "OPS"]); all if empty. */
  ticketPrefixes: string[];
  enabled: boolean;
}

export const REF_COLORS: Record<RefKind, string> = {
  issue: "#79b8ff",
  mr: "#c29bf0",
};

export const EMPTY_CONTEXT: RefContext = {
  base: null,
  origin: null,
  forge: null,
  ticketUrl: null,
  ticketPrefixes: [],
  enabled: true,
};

/** git@host:group/app.git, ssh://git@host:22/group/app, https://user@host/group/app.git → https://host/group/app */
export function remoteToWeb(remote: string): { base: string; origin: string; host: string } | null {
  let r = remote.trim();
  let host = "";
  let path = "";
  let m = /^[\w.-]+@([^:/]+):(?!\d+\/)(.+)$/.exec(r); // scp-like
  if (m) {
    host = m[1];
    path = m[2];
  } else {
    m = /^(?:ssh|git|https?):\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/.exec(r);
    if (!m) return null;
    host = m[1];
    path = m[2];
  }
  path = path.replace(/\.git\/?$/, "").replace(/\/+$/, "");
  if (!host || !path) return null;
  return { base: `https://${host}/${path}`, origin: `https://${host}`, host };
}

const cache = new Map<string, ReturnType<typeof load>>();

/**
 * Reads repository reference settings, sharing a recent lookup unless a fresh lookup is requested.
 * @param cwd - the repository folder
 * @param isFresh - reads Git again and reports lookup failures
 * @returns the repository reference settings
 */
export async function refContext(cwd: string | null | undefined, isFresh = false): Promise<RefContext> {
	if (cwd === null || cwd === undefined || cwd === '') {
		return EMPTY_CONTEXT;
	}
	let pending = cache.get(cwd);
	if (isFresh || pending === undefined) {
		pending = load(cwd);
		cache.set(cwd, pending);
		const lookup = pending;
		window.setTimeout(() => {
			if (cache.get(cwd) === lookup) {
				cache.delete(cwd);
			}
		}, 5 * 60_000);
	}
	try {
		const { context, error } = await pending;
		if (isFresh && error !== null) {
			throw new Error(error);
		}
		return context;
	} catch (error) {
		if (cache.get(cwd) === pending) {
			cache.delete(cwd);
		}
		if (isFresh) {
			throw error;
		}
		return EMPTY_CONTEXT;
	}
}

async function load(cwd: string): Promise<{ context: RefContext; error: string | null }> {
	const result = await invoke<{
		root?: string;
		remote: string | null;
		remote_error?: string | null;
		references: Record<string, unknown> | null;
	}>('project_refs', {
		cwd,
	});
	const conf = parseReferences(result.references ?? {});
	// "repo" in .heidrun/config.json overrides the Git remote.
	const source = conf.repo ?? result.remote;
	const web = source ? remoteToWeb(source) : null;
	// Unknown hosts are most often self-hosted GitLab.
	const forge: Forge | null = conf.forge ?? (web ? (web.host.includes('github') ? 'github' : 'gitlab') : null);
	const tickets = typeof conf.tickets === 'string'
		? {
			url: conf.tickets,
		}
		: conf.tickets ?? {};
	const context: RefContext = {
		...(result.root === undefined ? {} : { root: result.root }),
		base: web?.base ?? null,
		origin: web?.origin ?? null,
		forge,
		ticketUrl: tickets.url ?? null,
		ticketPrefixes: (tickets.prefixes ?? []).map((prefix) => prefix.toUpperCase()),
		enabled: conf.enabled !== false,
	};
	return {
		context,
		error: result.remote_error ?? null,
	};
}

export function issueUrl(base: string | null, forge: Forge | null, n: string): string | null {
  if (!base) return null;
  return forge === "github" ? `${base}/issues/${n}` : `${base}/-/issues/${n}`;
}

/** The web page of the repository of a remote address, and the forge that hosts it, or null when the address is unknown. */
export function webOfRemote(remote: string | null): { base: string; forge: Forge } | null {
  const address = remote === null ? null : remoteToWeb(remote);
  if (address === null) {
    return null;
  }
  return { base: address.base, forge: address.host.includes("github") ? "github" : "gitlab" };
}

/** The web page of a branch: `base/tree/branch` on GitHub, `base/-/tree/branch` on GitLab. The slashes of the name stay. */
export function branchUrl(base: string | null, forge: Forge | null, branch: string): string | null {
  if (base === null) {
    return null;
  }
  const path = branch.split("/").map(encodeURIComponent).join("/");
  return forge === "github" ? `${base}/tree/${path}` : `${base}/-/tree/${path}`;
}

export function mrUrl(base: string | null, forge: Forge | null, n: string): string | null {
  if (!base) return null;
  return forge === "github" ? `${base}/pull/${n}` : `${base}/-/merge_requests/${n}`;
}

function hostOf(address: string | null): string | null {
  if (address === null) {
    return null;
  }
  try {
    return new URL(address).hostname;
  } catch {
    return null;
  }
}

/**
 * Compares hosting addresses without the web scheme, query, fragment, or trailing slash.
 * @param first - The first repository or item address.
 * @param second - The second repository or item address.
 * @param forge - The hosting service, whose repository path may be case insensitive.
 * @returns True when both addresses identify the same repository or item.
 */
export function sameReferenceAddress(first: string | null, second: string | null, forge: Forge): boolean {
	if (first === null || second === null) {
		return false;
	}
	try {
		const firstAddress = new URL(first);
		const secondAddress = new URL(second);
		const firstPath = firstAddress.pathname.replace(/\/+$/, '');
		const secondPath = secondAddress.pathname.replace(/\/+$/, '');
		return firstAddress.host === secondAddress.host &&
			(forge === 'github' ? firstPath.toLowerCase() === secondPath.toLowerCase() : firstPath === secondPath);
	} catch {
		return false;
	}
}

/**
 * Finds issue and request addresses and shorthand references in one terminal line.
 * @param text - The terminal line, including wrapped rows.
 * @param context - The workspace repository and its reference settings.
 * @returns The references in their order in the text.
 */
export function findRefs(text: string, context: RefContext): RefMatch[] {
	if (context.enabled === false) {
		return [];
	}
	const references: RefMatch[] = [];
	const addresses = [...text.matchAll(DetectionPatterns.global(DetectionPatterns.REFERENCE_ADDRESS))];
	const contextHost = hostOf(context.origin);

	for (const match of addresses) {
		const url = match[0].replace(/[.,;:!?]+$/, '');
		let address: URL;
		try {
			address = new URL(url);
		} catch {
			continue;
		}
		if (address.username !== '' || address.password !== '') {
			continue;
		}
		const path = address.pathname.replace(/\/+$/, '');
		const isGithub = address.hostname === 'github.com' ||
			(context.forge === 'github' && address.hostname === contextHost);
		const isGitlab = address.hostname === 'gitlab.com' ||
			(context.forge === 'gitlab' && address.hostname === contextHost);
		const github = isGithub ? DetectionPatterns.GITHUB_ADDRESS_PATH.exec(path) : null;
		const gitlab = isGitlab ? DetectionPatterns.GITLAB_ADDRESS_PATH.exec(path) : null;
		const item = github ?? gitlab;
		if (item === null) {
			continue;
		}
		const project = path.slice(1, item.index);
		const segments = project.split('/');
		if (segments.some((segment) => segment === '') || segments.length < 2 ||
			(github !== null && segments.length !== 2)) {
			continue;
		}
		const kind = item[1] === 'pull' || item[1] === 'merge_requests' ? 'mr' : 'issue';
		references.push({
			start: match.index,
			end: match.index + url.length,
			kind,
			url,
			target: {
				type: kind,
				number: Number(item[2]),
				forge: github !== null ? 'github' : 'gitlab',
				project,
			},
		});
	}

	const pattern = context.forge === 'gitlab' ? DetectionPatterns.GITLAB_NUMBER : DetectionPatterns.HASH;
	for (const match of text.matchAll(DetectionPatterns.global(pattern))) {
		const start = match.index;
		if (addresses.some((address) => start >= address.index && start < address.index + address[0].length)) {
			continue;
		}
		const kind = match[0].startsWith('!') ? 'mr' : 'issue';
		const destination = kind === 'issue' ? issueUrl : mrUrl;
		const url = destination(context.base, context.forge, match[1]);
		if (url !== null) {
			references.push({
				start,
				end: start + match[0].length,
				kind,
				url,
				target: {
					type: kind,
					number: Number(match[1]),
				},
			});
		}
	}
	return references.sort((first, second) => first.start - second.start);
}

const AGENT_ROW = DetectionPatterns.AGENT_ROW;

export interface AgentRow {
  /** Position in the list (0 = first row, usually "main"). */
  index: number;
  name: string;
  /** Index in the line text where the marker starts. */
  start: number;
  current: boolean;
}

/**
 * The background agents / teammates list Claude Code shows below its prompt.
 * Only near the bottom of the screen, as a block of at least two rows.
 */
export function findAgentRow(lineAt: (i: number) => string | null, y: number, rows: number): AgentRow | null {
  if (y < rows - 24) return null;
  const line = lineAt(y);
  const m = line != null ? AGENT_ROW.exec(line) : null;
  if (!m) return null;
  let first = y;
  while (first > 0 && AGENT_ROW.test(lineAt(first - 1) ?? "")) first--;
  let last = y;
  while (AGENT_ROW.test(lineAt(last + 1) ?? "")) last++;
  if (last - first < 1) return null;
  return { index: y - first, name: m[3], start: m[1].length, current: "●◉⬤⏺•⦿".includes(m[2]) };
}

/**
 * The agent list as it is on screen now: names in order and the row the selection
 * pointer (❯) is on, or null when the focus is still in the prompt.
 */
export function agentListState(
  lineAt: (i: number) => string | null,
  rows: number,
): { names: string[]; selected: number | null; current?: number | null } | null {
  for (let y = rows - 1; y >= Math.max(0, rows - 24); y--) {
    const row = findAgentRow(lineAt, y, rows);
    if (!row) continue;
    const first = y - row.index;
    const names: string[] = [];
    let selected: number | null = null;
    let current: number | null = null;
    for (let i = first; ; i++) {
      const m = AGENT_ROW.exec(lineAt(i) ?? "");
      if (!m) break;
      if (/[❯›>▸▶]/.test(m[1])) selected = names.length;
      // ● marks the agent shown, ○ the others.
      if ("●◉⬤⏺•⦿".includes(m[2])) current = names.length;
      names.push(m[3]);
    }
    return { names, selected, current };
  }
  return null;
}

/**
 * The question that ends the agent's last message, if any: « Veux-tu que je
 * m'attaque à #44 ? », « On fusionne ? »… The prompt box and the footer under it
 * are ignored; only the last message (after the last ● / ⏺) is considered.
 */
export function findQuestion(screen: string): string | null {
  const lines = screen.replace(/\r/g, "").split("\n");
  const rule = (l: string) => DetectionPatterns.PROMPT_BOX_RULE.test(l);
  // Cut at the top of the prompt box (second-to-last rule), when there is one.
  const rules = lines.map((l, i) => (rule(l) ? i : -1)).filter((i) => i >= 0);
  const end = rules.length >= 2 ? rules[rules.length - 2] : rules.length === 1 ? rules[0] : lines.length;
  // Status lines under the answer: "✻ Worked for 2m 3s", "* Waiting for 1 background
  // agent", spinners, hints. They come after the text and must not hide its ending.
  const status = (l: string) => /^\s*([✻✶✳✢✽✦·*⏺●]\s+(Worked|Cooked|Baked|Brewed|Churned|Waiting|Thinking|Running)|[✻✶✳✢✽✦·]\s|\*\s+\S.*…|⎿|⏵|▸▸|►►)/.test(l);
  const body = lines.slice(0, end);
  let last = body.length - 1;
  while (last >= 0 && (!body[last].trim() || status(body[last]))) last--;
  if (last < 0) return null;
  // The last paragraph of the answer (it may be long: no need to find its start).
  let first = last;
  while (first > 0 && body[first - 1].trim() && !status(body[first - 1]) && last - first < 12) first--;
  const para = body.slice(first, last + 1);
  // Your own prompt echoed back ("❯ …") is not a question from the agent.
  if (/^\s*[❯>]/.test(para[0])) return null;
  const msg = para.map((l) => l.replace(/^\s{0,2}[●⏺]\s/, "").trim()).filter(Boolean);
  // The question must be at the very end of the message (last 3 lines).
  const tail = msg.slice(-3).join(" ").replace(/\s+/g, " ").trim();
  if (DetectionPatterns.QUESTION_END.test(tail) === false) return null;
  const sentences = tail.split(/(?<=[.!?:])\s+(?=[A-ZÀ-ÖØ-Ý«"(\d])/);
  const q = sentences[sentences.length - 1].trim();
  return q.length > 220 ? `…${q.slice(-220)}` : q;
}

// ---- Numbered menus of a blocked agent ("1. Yes / 2. … / 3. No") -------------

export interface Choice {
  n: number;
  label: string;
  selected: boolean;
}

export interface ChoiceMenu {
  question: string;
  /** Lines of the dialog above the question (the command or file concerned). */
  detail: string;
  options: Choice[];
}

const OPTION = DetectionPatterns.OPTION;

/**
 * The menu a blocked agent shows: the last run of options numbered 1, 2, 3…
 * (wrapped labels allowed), and the question just above it.
 */
export function findChoices(screen: string): ChoiceMenu | null {
  const raw = screen.replace(/\r/g, "").split("\n").slice(-60);
  // Drop the dialog frame: "│ … │", "╭───╮".
  const lines = raw.map((l) => l.replace(/^\s*[│┃|]\s?/, "").replace(/\s?[│┃|]\s*$/, ""));
  let best: { start: number; end: number; options: Choice[] } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const m = OPTION.exec(lines[i]);
    if (!m || m[2] !== "1") continue;
    const options: Choice[] = [{ n: 1, label: m[3], selected: !!m[1] }];
    let labelCol = lines[i].indexOf(m[3]);
    let lastOption = i;
    let gap = 0;
    for (let j = i + 1; j < lines.length && gap <= 2; j++) {
      const o = OPTION.exec(lines[j]);
      const indent = lines[j].search(/\S/);
      if (o && Number(o[2]) === options.length + 1) {
        options.push({ n: Number(o[2]), label: o[3], selected: !!o[1] });
        labelCol = lines[j].indexOf(o[3]);
        lastOption = j;
        gap = 0;
      } else if (indent >= 0 && indent >= labelCol && gap === 0) {
        // Wrapped label: continues the previous option.
        options[options.length - 1].label += ` ${lines[j].trim()}`;
        lastOption = j;
      } else {
        gap++;
      }
    }
    if (options.length >= 2) best = { start: i, end: lastOption, options };
  }
  if (!best) return null;
  // A real menu is the last thing on screen (frame, hints like "Esc to cancel"
  // aside) and has exactly one selected option: not a list in the agent's text.
  const after = lines.slice(best.end + 1).filter((l) => l.trim() && !/^\s*[╰╭─━└┌]/.test(l));
  if (after.length > 3) return null;
  if (best.options.filter((o) => o.selected).length !== 1) return null;
  let question = "";
  let q = -1;
  for (let k = best.start - 1; k >= Math.max(0, best.start - 4); k--) {
    const t = lines[k].trim();
    if (!t || /^[╭╰─━┌└]/.test(t)) continue;
    question = t;
    q = k;
    break;
  }
  const detail = q > 0
    ? lines
        .slice(Math.max(0, q - 8), q)
        .map((l) => l.trim())
        .filter((l) => l && !/^[╭╰─━┌└]/.test(l))
        .join("\n")
    : "";
  return { question, detail, options: best.options.map((o) => ({ ...o, label: o.label.length > 90 ? `${o.label.slice(0, 90)}…` : o.label })) };
}
