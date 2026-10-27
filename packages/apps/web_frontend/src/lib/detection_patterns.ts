///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DetectionPatterns — the regular expressions of the text detection, in one place
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Every regular expression that decides what the text detection finds in a terminal. `lib/refs.ts` runs them, and the Settings
 * window shows them, so the page shows the same pattern that the terminal uses. A pattern here has no `g` flag: `global` makes
 * a fresh copy for a loop that needs `lastIndex`. Issue #638.
 */
export class DetectionPatterns {
	/**
	 * The web address that the web-link add-on of the terminal finds. It is the default pattern of the add-on, written here so
	 * that the terminal, the sample field, and the Settings window use one pattern.
	 */
	static readonly WEB_ADDRESS = /(https?|HTTPS?):[/]{2}[^\s"'!*(){}|\\\^<>`]*[^\s"':,.!?{}|\\\^~\[\]`()<>]/;

	/** Finds a web address in a line of text, for the references that are written as an address. */
	static readonly REFERENCE_ADDRESS = /\bhttps?:\/\/[^\s"'<>)\]]+/;

	/** The end of the path of a GitHub address of an issue or of a pull request. */
	static readonly GITHUB_ADDRESS_PATH = /\/(issues|pull)\/(\d+)$/;

	/** The end of the path of a GitLab address of an issue or of a merge request. */
	static readonly GITLAB_ADDRESS_PATH = /\/-\/(issues|merge_requests)\/(\d+)$/;

	/** The end of the path of a GitHub address of a commit. */
	static readonly GITHUB_COMMIT_PATH = /\/commit\/[0-9a-f]{7,40}$/;

	/** The end of the path of a GitLab address of a commit. */
	static readonly GITLAB_COMMIT_PATH = /\/-\/commit\/[0-9a-f]{7,40}$/;

	/** An address without its host, in the form of GitLab: "/-/issues/3", "group/sub/app/-/merge_requests/3". */
	static readonly GITLAB_PATH_ADDRESS = /(?<![\w/.:@~-])\/?((?:[A-Za-z0-9_.-]+\/)+)?-\/(issues|merge_requests)\/(\d+)(?![\w/-])/;

	/** An address without its host, in the form of GitHub: "/issues/12", "org/app/pull/5". */
	static readonly GITHUB_PATH_ADDRESS = /(?<![\w/.:@~-])(?:\/(issues|pull)\/(\d+)|([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/(issues|pull)\/(\d+))(?![\w/-])/;

	/** The words "PR", "MR", "pull request", or "merge request", and a number. */
	static readonly EXPLICIT_REQUEST = /\b(PR|MR|pull request|merge request)\s?([#!]?)(\d+)\b/i;

	/** The path of another repository, and a number: "org/lib#7", "group/sub/app!3". */
	static readonly CROSS_REPOSITORY = /(?<![\w/.:-])([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)([#!])(\d+)\b/;

	/** An exclamation mark and a number, the merge request of GitLab. */
	static readonly BANG = /(?<![\w!])!(\d+)\b/;

	/** A number sign and a number, an issue, but not the text `[Image #N]` of a chat, which shows its image (issue #924). */
	static readonly HASH = /(?<![\w&#/])(?<!\[Image )#(\d+)\b/;

	/** A ticket key: capital letters, a hyphen, and a number. */
	static readonly TICKET = /\b([A-Z][A-Z0-9]{1,9})-(\d+)\b/;

	/** A commit identifier: 7 to 40 characters from 0 to 9 and a to f. */
	static readonly COMMIT_HASH = /(?<![\w-])[0-9a-f]{7,40}(?![\w-])/;

	/** A file path: folders, a file name with an extension, and an optional line and column. */
	static readonly FILE_PATH = /(^|[\s([{"'`«])((?:\.{1,2}\/|~\/|\/)?(?:[\w@.+-]+\/)+[\w@+-][\w@.+-]*\.[A-Za-z][A-Za-z0-9]{0,24}|[\w@+-][\w@.+-]*\.[A-Za-z][A-Za-z0-9]{0,24}(?=:\d))(?::(\d{1,6})(?::\d{1,4})?)?(?=$|[\s)\]}"'`»,;!?]|\.(?=$|[\s)\]}"'`»]))/;

	/** A slash and the name of a command: "/compact". */
	static readonly SLASH_COMMAND = /(?<![\w/.~:-])\/([a-z][\w:-]*\w)(?![\w/]|\.\w)/i;

	/** A number of one or two digits, a full stop or a closing parenthesis, and the text of the item. */
	static readonly NUMBERED_STEP = /^(\s{0,8})(\d{1,2})[.)]\s+(\S.*?)\s*$/;

	/** A line that starts with an exclamation mark and a command: "! git status". */
	static readonly SHELL_BLOCK_START = /^(\s*)!\s*(\S.*)$/;

	/** An exclamation mark inside a sentence, before a command: "run ! pnpm test". */
	static readonly INLINE_SHELL = /(^|[\s(«"“])(`?)!\s+(?=[\w./~$-])/;

	/** A row of the agent list of Claude Code: a marker, and the name of an agent. */
	static readonly AGENT_ROW = /^(\s{0,12}(?:[❯›>▸▶]\s*)?)([●○◉◯◎⬤⏺•◦∘⦿])\s+([\w.@:/-]+)(?:\s{2,}\S.*)?\s*$/u;

	/** A horizontal rule of at least 8 characters, the top or the bottom of the input box of Claude Code. */
	static readonly PROMPT_BOX_RULE = /^\s*[─━]{8,}/;

	/** A question mark at the end of the last lines of a message. */
	static readonly QUESTION_END = /\?\s*[)»"”]*\s*$/;

	/** A numbered option of a menu: "1. Yes", "❯ 2. No". */
	static readonly OPTION = /^\s*([❯›>▶]\s*)?(\d{1,2})[.)]\s+(\S.*?)\s*$/;

	/**
	 * Makes a fresh copy of a pattern with the flag `g`, for a loop with `exec`. The pattern itself never holds a `lastIndex`.
	 *
	 * @param pattern - A pattern of this class.
	 * @returns A new regular expression with the same source, with the flag `g` added.
	 */
	static global(pattern: RegExp): RegExp {
		const flags = pattern.flags.includes('g') === true ? pattern.flags : `${pattern.flags}g`;
		return new RegExp(pattern.source, flags);
	}
}
