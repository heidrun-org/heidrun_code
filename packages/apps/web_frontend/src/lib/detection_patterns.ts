///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DetectionPatterns — the regular expressions of the text detection, in one place
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export class DetectionPatterns {
	/** The default web address pattern of the terminal link add-on. */
	static readonly WEB_ADDRESS = /(https?|HTTPS?):[/]{2}[^\s"'!*(){}|\\\^<>`]*[^\s"':,.!?{}|\\\^~\[\]`()<>]/;

	/** Finds a web address in a line of text, for the references that are written as an address. */
	static readonly REFERENCE_ADDRESS = /\bhttps?:\/\/[^\s"'<>`)}\]]+/i;

	/** The end of the path of a GitHub address of an issue or of a pull request. */
	static readonly GITHUB_ADDRESS_PATH = /\/(issues|pull)\/(\d+)$/;

	/** The end of the path of a GitLab address of an issue or of a merge request. */
	static readonly GITLAB_ADDRESS_PATH = /\/-\/(issues|work_items|merge_requests)\/(\d+)$/;

	/** An issue or merge request number on GitLab, excluding chat image markers. */
	static readonly GITLAB_NUMBER = /(?:(?<![\w&#/])(?<!\[Image )#|(?<![\w!/])!)(\d+)\b/;

	/** An issue or pull request number on GitHub, excluding chat image markers. */
	static readonly HASH = /(?<![\w&#/])(?<!\[Image )#(\d+)\b/;

	/** A row of the agent list of Claude Code: a marker, and the name of an agent. */
	static readonly AGENT_ROW = /^(\s{0,12}(?:[❯›>▸▶]\s*)?)([●○◉◯◎⬤⏺•◦∘⦿])\s+([\w.@:/-]+)(?:\s{2,}\S.*)?\s*$/u;

	/** A horizontal edge of the Claude Code input box, used when reading the last question. */
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
