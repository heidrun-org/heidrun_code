// Issue / MR / PR / ticket / commit references in terminal output:
// found per screen line, then colored (decorations) and made clickable (link provider).
import { invoke } from "@tauri-apps/api/core";
import { DetectionPatterns } from "./detection_patterns";
import { parseReferences } from "./project_config";
import { WrappedLines } from "./wrapped_lines";

export type RefKind = "issue" | "mr" | "ticket" | "commit";
export type Forge = "github" | "gitlab";

/**
 * The rule that found a reference. "fullAddress" is the address with its host, "pathAddress" the address without its host
 * ("/issues/12", "org/app/pull/5"), "explicit" is "PR #12", "crossRepository" is "group/app#12", "bang" is "!34", "hash" is
 * "#12", "ticket" is "ABC-123", "commitHash" is the hexadecimal identifier, and "commitAddress" is the address of a commit.
 */
export type RefRule =
  | "fullAddress"
  | "commitAddress"
  | "pathAddress"
  | "explicit"
  | "crossRepository"
  | "bang"
  | "hash"
  | "ticket"
  | "commitHash";

export interface RefMatch {
  start: number; // index in the line text
  end: number; // exclusive
  kind: RefKind;
  url: string | null;
  /** The rule that found the reference. */
  rule: RefRule;
  /** Issue / MR that the app can show itself (in-app preview). */
  target?: RefTarget;
}

/** An issue or a merge request that the application previews itself. */
export interface RefTarget {
  type: "issue" | "mr";
  number: number;
  /** The repository, when the text names it ("group/app#12", a full address). Absent: the repository of the pane. */
  project?: string;
  /** The forge of the explicit repository, when the text tells it (a full address). Absent: the forge of the pane. */
  forge?: Forge;
}

export interface RefContext {
  /** Web URL of the repository, e.g. https://gitlab.com/group/app */
  base: string | null;
  /** Web origin, e.g. https://gitlab.com (for `group/app#12`) */
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
  ticket: "#6fd0c8",
  commit: "#e0b080",
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

const cache = new Map<string, Promise<RefContext>>();

/** Context for a pane's folder; cached per folder. */
export function refContext(cwd: string | null | undefined): Promise<RefContext> {
  const key = cwd || "";
  if (!key) return Promise.resolve(EMPTY_CONTEXT);
  let p = cache.get(key);
  if (!p) {
    p = load(key);
    cache.set(key, p);
    // Remotes rarely change, but a new clone in the same folder should be picked up.
    window.setTimeout(() => cache.delete(key), 5 * 60_000);
  }
  return p;
}

async function load(cwd: string): Promise<RefContext> {
  try {
    const r = await invoke<{ root: string; remote: string | null; references: Record<string, unknown> | null }>(
      "project_refs",
      { cwd },
    );
    const conf = parseReferences(r.references ?? {});
    // "repo" in .heidrun/config.json overrides the git remote (any form git accepts, or the web URL).
    const source = conf.repo ?? r.remote;
    const web = source ? remoteToWeb(source) : null;
    // Unknown hosts are most often self-hosted GitLab; GitHub is github.com.
    const forge: Forge | null = conf.forge ?? (web ? (web.host.includes("github") ? "github" : "gitlab") : null);
    const tickets = typeof conf.tickets === "string" ? { url: conf.tickets } : conf.tickets ?? {};
    return {
      base: web?.base ?? null,
      origin: web?.origin ?? null,
      forge,
      ticketUrl: tickets.url ?? null,
      ticketPrefixes: (tickets.prefixes ?? []).map((x) => x.toUpperCase()),
      enabled: conf.enabled !== false,
    };
  } catch {
    return EMPTY_CONTEXT;
  }
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

// Words that look like tickets but are not (UTF-8, SHA-256…), when no prefix list is set.
const NOT_TICKETS = new Set(["UTF", "ISO", "SHA", "RFC", "CVE", "GPT", "MD", "HTTP", "TLS", "SSL", "ES", "IPV", "X", "COVID", "MP", "AES", "RSA"]);

/** The host name of a web address, or null when the text is not a web address. */
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
 * All references in one line of text, without overlaps. The rules run in a fixed order and the first rule that finds a piece
 * of text keeps it: the order is the precedence, and a later rule never takes the text back.
 */
export function findRefs(line: string, ctx: RefContext): RefMatch[] {
  if (!ctx.enabled || line.trim().length < 2) return [];
  const out: RefMatch[] = [];
  const taken = (s: number, e: number) => out.some((m) => s < m.end && e > m.start);
  const add = (s: number, e: number, kind: RefKind, url: string | null, rule: RefRule, target?: RefMatch["target"]) => {
    if (!taken(s, e)) out.push({ start: s, end: e, kind, url, rule, target });
  };
  let m: RegExpExecArray | null;
  const contextHost = hostOf(ctx.origin);

  // Skip URLs: the web links addon handles them, and "#123" inside one is not ours.
  const urls: [number, number][] = [];
  const urlRe = DetectionPatterns.global(DetectionPatterns.REFERENCE_ADDRESS);
  while ((m = urlRe.exec(line))) urls.push([m.index, m.index + m[0].length]);
  const inUrl = (i: number) => urls.some(([s, e]) => i >= s && i < e);

  // GitHub and GitLab issue and pull request addresses get the same hover actions as #12 and !34. An address of
  // another site ("https://example.com/issues/12") is not ours: only github.com and the host of the repository count.
  for (const [start, end] of urls) {
    const address = line.slice(start, end).replace(/[.,;:!?]+$/, "");
    let parsed: URL;
    try {
      parsed = new URL(address);
    } catch {
      continue;
    }
    const path = parsed.pathname.replace(/\/+$/, "");
    const isGithubHost = parsed.hostname === "github.com" || (ctx.forge === "github" && parsed.hostname === contextHost);
    const github = DetectionPatterns.GITHUB_ADDRESS_PATH.exec(path);
    if (github && isGithubHost) {
      const kind = github[1] === "pull" ? "mr" : "issue";
      const pathParts = path.slice(0, github.index).replace(/^\/+|\/+$/g, "").split("/");
      const project = pathParts.slice(-2).join("/");
      add(start, start + address.length, kind, address, "fullAddress", {
        type: kind,
        number: Number(github[2]),
        forge: "github",
        ...(project.length > 0 ? { project } : {}),
      });
      continue;
    }
    const gitlab = DetectionPatterns.GITLAB_ADDRESS_PATH.exec(path);
    if (gitlab && (parsed.hostname !== "github.com" || ctx.forge === "gitlab")) {
      const kind = gitlab[1] === "merge_requests" ? "mr" : "issue";
      const project = path.slice(0, gitlab.index).replace(/^\/+|\/+$/g, "");
      add(start, start + address.length, kind, address, "fullAddress", {
        type: kind,
        number: Number(gitlab[2]),
        forge: "gitlab",
        ...(project.length > 0 ? { project } : {}),
      });
      continue;
    }
    if (DetectionPatterns.GITLAB_COMMIT_PATH.test(path) || (DetectionPatterns.GITHUB_COMMIT_PATH.test(path) && isGithubHost)) {
      add(start, start + address.length, "commit", address, "commitAddress");
    }
  }

  // The address without its host: "/issues/12", "org/app/issues/12", "/pull/5", "/-/issues/3", "group/sub/app/-/merge_requests/3".
  // It opens the same destination as "#12" or "!34", on the host of the repository of the pane.
  const addPath = (s: number, e: number, kind: "issue" | "mr", number: number, project: string | undefined) => {
    const base = project === undefined ? ctx.base : ctx.origin ? `${ctx.origin}/${project}` : null;
    const url = kind === "mr" ? mrUrl(base, ctx.forge, String(number)) : issueUrl(base, ctx.forge, String(number));
    add(s, e, kind, url, "pathAddress", { type: kind, number, ...(project === undefined ? {} : { project }) });
  };
  const gitlabPath = DetectionPatterns.global(DetectionPatterns.GITLAB_PATH_ADDRESS);
  while ((m = gitlabPath.exec(line))) {
    if (inUrl(m.index)) continue;
    const project = m[1] === undefined ? undefined : m[1].replace(/\/+$/, "");
    addPath(m.index, m.index + m[0].length, m[2] === "merge_requests" ? "mr" : "issue", Number(m[3]), project);
  }
  const githubPath = DetectionPatterns.global(DetectionPatterns.GITHUB_PATH_ADDRESS);
  while ((m = githubPath.exec(line))) {
    if (inUrl(m.index)) continue;
    const word = m[1] ?? m[4];
    addPath(m.index, m.index + m[0].length, word === "pull" ? "mr" : "issue", Number(m[2] ?? m[5]), m[3]);
  }

  // 1. "PR #12", "MR !34", "merge request 34", "pull request #5"
  const explicit = DetectionPatterns.global(DetectionPatterns.EXPLICIT_REQUEST);
  while ((m = explicit.exec(line))) {
    if (inUrl(m.index)) continue;
    add(m.index, m.index + m[0].length, "mr", mrUrl(ctx.base, ctx.forge, m[3]), "explicit", { type: "mr", number: Number(m[3]) });
  }

  // 2. "group/app#12", "group/app!34" (another repository on the same forge)
  const cross = DetectionPatterns.global(DetectionPatterns.CROSS_REPOSITORY);
  while ((m = cross.exec(line))) {
    if (inUrl(m.index)) continue;
    const base = ctx.origin ? `${ctx.origin}/${m[1]}` : null;
    const isMr = m[2] === "!";
    add(
      m.index,
      m.index + m[0].length,
      isMr ? "mr" : "issue",
      isMr ? mrUrl(base, ctx.forge, m[3]) : issueUrl(base, ctx.forge, m[3]),
      "crossRepository",
      { type: isMr ? "mr" : "issue", number: Number(m[3]), project: m[1] },
    );
  }

  // 3. "!34": GitLab merge request
  if (ctx.forge !== "github") {
    const bang = DetectionPatterns.global(DetectionPatterns.BANG);
    while ((m = bang.exec(line))) {
      if (inUrl(m.index)) continue;
      add(m.index, m.index + m[0].length, "mr", mrUrl(ctx.base, ctx.forge, m[1]), "bang", { type: "mr", number: Number(m[1]) });
    }
  }

  // 4. "#12": issue (GitHub redirects to the PR when it is one)
  const hash = DetectionPatterns.global(DetectionPatterns.HASH);
  while ((m = hash.exec(line))) {
    if (inUrl(m.index)) continue;
    add(m.index, m.index + m[0].length, "issue", issueUrl(ctx.base, ctx.forge, m[1]), "hash", { type: "issue", number: Number(m[1]) });
  }

  // 5. Tickets "ABC-123": only when the project sets a ticket URL.
  if (ctx.ticketUrl) {
    const ticket = DetectionPatterns.global(DetectionPatterns.TICKET);
    while ((m = ticket.exec(line))) {
      if (inUrl(m.index)) continue;
      const prefix = m[1];
      if (ctx.ticketPrefixes.length ? !ctx.ticketPrefixes.includes(prefix) : NOT_TICKETS.has(prefix)) continue;
      add(m.index, m.index + m[0].length, "ticket", ctx.ticketUrl.replace("{key}", m[0]), "ticket");
    }
  }

  // 6. Commit hashes: 7–40 hex chars with both letters and digits.
  const sha = DetectionPatterns.global(DetectionPatterns.COMMIT_HASH);
  while ((m = sha.exec(line))) {
    const h = m[0];
    if (inUrl(m.index) || !/[a-f]/.test(h) || !/\d/.test(h)) continue;
    add(m.index, m.index + h.length, "commit", ctx.base ? (ctx.forge === "github" ? `${ctx.base}/commit/${h}` : `${ctx.base}/-/commit/${h}`) : null, "commitHash");
  }

  return out.sort((a, b) => a.start - b.start);
}

// ---- Things the agent suggests doing: slash commands and numbered steps ------

const commandCache = new Map<string, Promise<Set<string>>>();

/** Slash commands Claude Code knows in this folder (built-ins, user, project, plugins). */
export function claudeCommands(cwd: string | null | undefined): Promise<Set<string>> {
  const key = cwd || "";
  let p = commandCache.get(key);
  if (!p) {
    p = invoke<string[]>("claude_commands", { cwd: cwd || null })
      .then((list) => new Set(list.map((c) => c.toLowerCase())))
      .catch(() => new Set<string>());
    commandCache.set(key, p);
    window.setTimeout(() => commandCache.delete(key), 2 * 60_000);
  }
  return p;
}

export interface CommandMatch {
  start: number;
  end: number;
  command: string; // "/fin-tache"
}

/** "/fin-tache", "/compact"… but only real commands, never paths like /tmp/x. */
export function findCommands(line: string, known: ReadonlySet<string>): CommandMatch[] {
  if (!known.size || !line.includes("/")) return [];
  const out: CommandMatch[] = [];
  const re = DetectionPatterns.global(DetectionPatterns.SLASH_COMMAND);
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (known.has(m[1].toLowerCase())) out.push({ start: m.index, end: m.index + m[0].length, command: m[0] });
  }
  return out;
}

export interface StepMatch {
  start: number; // the "1." marker
  end: number;
  number: number;
  text: string; // first line of the item, for the prompt
}

/** "  1. Ouvrir une issue…", "2) Committer…": an item of a numbered list. */
export function findStep(line: string): StepMatch | null {
  const m = DetectionPatterns.NUMBERED_STEP.exec(line);
  if (!m || m[3].length < 4) return null;
  const start = m[1].length;
  return { start, end: line.length - (line.length - line.trimEnd().length), number: Number(m[2]), text: m[3] };
}

// ---- Shell commands for Claude's "!" mode ------------------------------------

export interface ShellBlock {
  /** First and last screen lines of the command (0-based). */
  first: number;
  last: number;
  /** Where the "!" sits on the first line (index in its text). */
  start: number;
  /** The command as one line, without the "!". */
  command: string;
}

const NEW_ITEM = /^\s*(?:[!•⏺⎿>❯$#*-]|\d{1,2}[.)]\s)/;
/** A new command or a new item of the agent: it ends a command, also after a line that the agent wrapped. */
const NEW_COMMAND = /^\s*[!•⏺⎿❯]/;
const BANG = DetectionPatterns.SHELL_BLOCK_START;
const indentOf = (s: string) => s.length - s.trimStart().length;

/**
 * "! docker builder prune -af && docker image prune -af", possibly spread over
 * several screen lines: wrapped by the agent, or continued with \, &&, ||, | or ;.
 * `lineAt(i)` returns the text of screen line i (or null past the end).
 * `textEndsAtLastLine` is true for a sample text, which ends at its last line.
 * A line that the agent wrapped is joined with one space, or with no space after a
 * word cut at the right edge (`WrappedLines`). A line that starts with "-" goes on
 * the command when the line before was wrapped or continued ("--reporter verbose").
 * A command of more than `WrappedLines.MAX_ROWS` lines, or that reaches the last line
 * of the screen (it may go on below, out of sight), is not proposed, rather than cut.
 * The "!" needs a space after it, so "!48 is merged" (a merge request) is not a
 * command (issue #574).
 */
export function findShellBlock(
  lineAt: (i: number) => string | null,
  y: number,
  cols: number,
  textEndsAtLastLine = false,
): ShellBlock | null {
  // The hovered line may be a continuation: look up for the "!".
  for (let first = y; first >= Math.max(0, y - WrappedLines.MAX_ROWS); first--) {
    const head = lineAt(first);
    if (head == null) break;
    const m = BANG.exec(head);
    if (!m || /^!\w/.test(m[2]) || !/^\s*!\s/.test(head)) {
      if (!head.trim()) break; // a blank line ends any block
      continue;
    }
    const bangIndent = m[1].length;
    let command = m[2].trimEnd();
    let last = first;
    let prev = head.trimEnd();
    for (let i = first + 1; ; i++) {
      const line = lineAt(i);
      // Past the bottom of the screen: the command may go on out of sight. Past the end of a sample text, it is complete.
      if (line == null && !textEndsAtLastLine) return null;
      if (line == null || !line.trim()) break;
      if (i - first >= WrappedLines.MAX_ROWS) return null;
      const indent = indentOf(line);
      const continued = /(\\|&&|\|\||\||;)$/.test(prev);
      const wrapped = WrappedLines.isWrapped(prev, line, cols);
      if (indent < bangIndent || (!continued && NEW_COMMAND.test(line))) break;
      if (!continued && !wrapped && (NEW_ITEM.test(line) || indent <= bangIndent)) break;
      if (continued) {
        command = command.replace(/\s*\\$/, "") + " " + line.trim();
      } else if (wrapped) {
        command += WrappedLines.separator(prev, cols) + line.trim();
      } else {
        command += " " + line.trim();
      }
      prev = line.trimEnd();
      last = i;
    }
    if (y > last) return null;
    command = command.replace(/\s*\\$/, "").trim();
    if (command.length < 2) return null;
    return { first, last, start: bangIndent, command };
  }
  return null;
}

const SHELL_TOOLS = new Set(
  ("git npm pnpm yarn npx bun deno node python python3 pip pip3 uv docker podman make cargo rustc go ls cd cat less rm mv cp " +
    "touch mkdir chmod chown ln curl wget brew gh glab kubectl helm ssh scp rsync sudo tail head grep rg find echo export " +
    "env source sh bash zsh tauri flutter dart php composer symfony herdr claude codex open killall lsof ps kill pkill jq yq " +
    "psql mysql redis-cli sqlite3 terraform ansible vercel wrangler supabase firebase gcloud aws az du df tar zip unzip " +
    "sed awk sort uniq wc xargs watch time which diff patch tree code ngrok").split(" "),
);

/**
 * "… lance ! scripts/identifier-jeton-pages.sh. Si la révocation…": a shell-mode
 * command quoted inside a sentence. It ends at the end of the sentence (". " then
 * a capital letter, or the end of the line), at a closing backtick, or at " ou " / " puis ".
 */
export function findInlineShell(text: string): { start: number; end: number; command: string }[] {
  const out: { start: number; end: number; command: string }[] = [];
  const re = DetectionPatterns.global(DetectionPatterns.INLINE_SHELL);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[1].length;
    const from = re.lastIndex;
    const rest = text.slice(from);
    let len: number;
    if (m[2]) {
      const close = rest.indexOf("`");
      if (close <= 0) continue;
      len = close;
    } else {
      const stop = /(\.\s+(?=\p{Lu})|\.\s*$|,\s|;\s|\s+(ou|puis|or|then)\s|\s*»|\s*$)/u.exec(rest);
      len = stop ? stop.index : rest.length;
    }
    const command = rest.slice(0, len).replace(/[.,;:]+$/, "").trim();
    // "C'est super ! Bravo" is French punctuation, not a command: the first word
    // must look like one (a path, a script, or a common tool).
    const head = command.split(/\s+/)[0];
    if (command.length < 2 || !(/[/.]/.test(head) || SHELL_TOOLS.has(head))) continue;
    const end = from + rest.slice(0, len).replace(/[.,;:]+$/, "").length + (m[2] ? 1 : 0);
    out.push({ start, end, command });
    re.lastIndex = end;
  }
  return out;
}

/**
 * File paths cited in a terminal: "src/app.ts", "src/app.ts:42", "./lib/x.rs:10:5",
 * or a bare name with a line ("app.ts:42"). A bare name without line is too vague.
 * A path ends where the word ends: a dot ends it only when a space, the end of the line, or a closing mark follows the dot
 * (a full stop), so "~/Library/WebKit/dev.heidrun-org.heidrun-code.development" is one path and never stops at ".heidrun".
 * The last piece after the final dot (the extension) has 1 to 25 letters and digits.
 */
export function findFileRefs(text: string): { start: number; end: number; path: string; line: number | null }[] {
  const out: { start: number; end: number; path: string; line: number | null }[] = [];
  const re =
    DetectionPatterns.global(DetectionPatterns.FILE_PATH);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[1].length;
    const path = m[2];
    // URLs are handled elsewhere ("https://x.io/a.js" has "//").
    if (/^\/\//.test(path) || text.slice(Math.max(0, start - 3), start).endsWith(":/")) continue;
    if (/^\d+(\.\d+)+$/.test(path)) continue; // a version, "1.2.3"
    // Host names ("db.example.com:5432", "github.com/x/y.git"): not files.
    const first = path.replace(/^(\.{1,2}\/|~\/|\/)/, "").split("/")[0];
    if (/\.(com|net|org|io|dev|fr|eu|app|co|ai|cloud)$/i.test(first) && path.includes("/") || (!path.includes("/") && /\.(com|net|org|io|dev|fr|eu|app|co|ai|cloud)$/i.test(path))) continue;
    const end = start + m[0].length - m[1].length;
    out.push({ start, end, path, line: m[3] ? Number(m[3]) : null });
  }
  return out;
}

// ---- Claude Code's agent list under the prompt ("● main", "○ jerome-645 …") -----

// Filled marker = the agent shown; hollow = the others. Several glyphs, depending on
// the Claude Code version and the font.
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
 * Is screen line `y` inside Claude Code's prompt box (between the two ─── rules,
 * the first line starting with ❯)? Returns the box's first and last lines.
 */
export function promptBoxAt(lineAt: (i: number) => string | null, y: number): { first: number; last: number } | null {
  const rule = (i: number) => DetectionPatterns.PROMPT_BOX_RULE.test(lineAt(i) ?? "");
  if (rule(y)) return null;
  let top = y - 1;
  while (top >= 0 && y - top <= 12 && !rule(top)) top--;
  let bottom = y + 1;
  while (lineAt(bottom) != null && bottom - y <= 12 && !rule(bottom)) bottom++;
  if (!rule(top) || !rule(bottom)) return null;
  if (!/^\s*[❯›>]/.test(lineAt(top + 1) ?? "")) return null;
  return { first: top + 1, last: bottom - 1 };
}

// ---- Questions asked by the agent in its answer -------------------------------

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
