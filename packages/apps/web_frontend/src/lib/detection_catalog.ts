import { DetectionPatterns } from './detection_patterns';
import type { DetectionFamilyId } from './detection_families';
import { DETECTION_FAMILY_IDS } from './detection_families';
import type { Forge, RefContext } from './refs';
import { TerminalDetection, type DetectedItem, type DetectionInput } from './terminal_detection';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DetectionCatalog — the rules of each detection family, with their real patterns and examples
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** What a rule needs from the pane or the project before it gives a destination or an action. */
export type CatalogNeed = 'repository' | 'ticketAddress' | 'gitlab' | 'knownCommands';

/** The kind of pane in which a rule works. */
export type CatalogPane = 'any' | 'agent' | 'claude';

/** One regular expression of a rule, with the identifier of its purpose. */
export type CatalogPattern = {
	/** The identifier of the purpose of the pattern. The text of the purpose is in the key `textDetection.pattern.<id>`. */
	id: string;
	/** The real regular expression that the detection runs. */
	regex: RegExp;
};

/** One rule of a detection family. */
export type CatalogRule = {
	/** The identifier of the rule, as `DetectedItem.rule` gives it. The name is in the key `textDetection.rule.<id>`. */
	id: string;
	/** The regular expressions that the rule runs, in the order that they run. */
	patterns: CatalogPattern[];
	/** The texts that the rule finds. Each one is run through the real detection by the test. */
	found: string[];
	/** The texts that look like the rule finds them, and that the rule refuses. */
	notFound: string[];
	/** The kind of pane in which the rule works. */
	pane: CatalogPane;
	/** What the rule needs before it gives a destination or an action, or null when it needs nothing. */
	need: CatalogNeed | null;
	/** The forge of the project in which the examples are run by the test. */
	forge: Forge;
};

/** One detection family, with its rules. */
export type CatalogFamily = {
	/** The detection family. */
	id: DetectionFamilyId;
	/** The rules of the family, in the order of the precedence. */
	rules: CatalogRule[];
};

/** The answer of the real detection for one example. */
export type CatalogCheck = {
	/** True when the rule found something in the example. */
	isFound: boolean;
	/** The piece of text that the rule found, or the question, or null. */
	text: string | null;
	/** The item that the rule found, or null for the rules that read the whole screen. */
	item: DetectedItem | null;
	/** The number of options of the menu that the rule found, or null. */
	choiceCount: number | null;
};

/** What the detection needs to read an example: the context of the pane and the switches. */
export type CatalogOptions = Omit<DetectionInput, 'lineAt' | 'row' | 'rows' | 'columns'>;

/** The rules of the text detection, written as data so that the Settings window and the tests read the same list. */
export class DetectionCatalog {
	/**
	 * The families and their rules. Every example is checked by the test `detection_catalog.test.ts`, so a rule that stops
	 * finding its example, or finds a refused example, fails the test.
	 */
	static readonly FAMILIES: CatalogFamily[] = [
		{
			id: 'webAddresses',
			rules: [
				{
					id: 'address',
					patterns: [{ id: 'finds', regex: DetectionPatterns.WEB_ADDRESS }],
					found: ['https://example.com/docs', 'http://localhost:5183/a?b=1#c', 'See https://example.com/x.'],
					notFound: ['ftp://example.com', 'example.com/docs'],
					pane: 'any',
					need: null,
					forge: 'github',
				},
			],
		},
		{
			id: 'issueReferences',
			rules: [
				{
					id: 'fullAddress',
					patterns: [
						{ id: 'finds', regex: DetectionPatterns.REFERENCE_ADDRESS },
						{ id: 'pathGithub', regex: DetectionPatterns.GITHUB_ADDRESS_PATH },
						{ id: 'pathGitlab', regex: DetectionPatterns.GITLAB_ADDRESS_PATH },
					],
					found: ['https://github.com/org/app/issues/569', 'https://gitlab.com/group/app/-/issues/3'],
					notFound: ['https://example.com/issues/12'],
					pane: 'any',
					need: null,
					forge: 'github',
				},
				{
					id: 'pathAddress',
					patterns: [
						{ id: 'pathGithubForm', regex: DetectionPatterns.GITHUB_PATH_ADDRESS },
						{ id: 'pathGitlabForm', regex: DetectionPatterns.GITLAB_PATH_ADDRESS },
					],
					found: ['/issues/569', 'org/app/issues/569', '/-/issues/3', 'group/sub/app/-/issues/3'],
					notFound: ['src/issues/12/index.ts'],
					pane: 'any',
					need: 'repository',
					forge: 'github',
				},
				{
					id: 'crossRepository',
					patterns: [{ id: 'finds', regex: DetectionPatterns.CROSS_REPOSITORY }],
					found: ['org/lib#7', 'group/sub/app#7'],
					notFound: ['org/lib #7'],
					pane: 'any',
					need: null,
					forge: 'github',
				},
				{
					id: 'hash',
					patterns: [{ id: 'finds', regex: DetectionPatterns.HASH }],
					found: ['fix #12', '(#569)'],
					notFound: ['a &#39; b', 'C#12', 'https://example.com/page#12'],
					pane: 'any',
					need: 'repository',
					forge: 'github',
				},
			],
		},
		{
			id: 'requestReferences',
			rules: [
				{
					id: 'fullAddress',
					patterns: [
						{ id: 'finds', regex: DetectionPatterns.REFERENCE_ADDRESS },
						{ id: 'pathGithub', regex: DetectionPatterns.GITHUB_ADDRESS_PATH },
						{ id: 'pathGitlab', regex: DetectionPatterns.GITLAB_ADDRESS_PATH },
					],
					found: ['https://github.com/org/app/pull/5', 'https://gitlab.com/group/sub/app/-/merge_requests/3'],
					notFound: ['https://example.com/pull/5'],
					pane: 'any',
					need: null,
					forge: 'github',
				},
				{
					id: 'pathAddress',
					patterns: [
						{ id: 'pathGithubForm', regex: DetectionPatterns.GITHUB_PATH_ADDRESS },
						{ id: 'pathGitlabForm', regex: DetectionPatterns.GITLAB_PATH_ADDRESS },
					],
					found: ['/pull/5', 'org/app/pull/5', '/-/merge_requests/3'],
					notFound: ['src/pull/5/index.ts'],
					pane: 'any',
					need: 'repository',
					forge: 'github',
				},
				{
					id: 'explicit',
					patterns: [{ id: 'finds', regex: DetectionPatterns.EXPLICIT_REQUEST }],
					found: ['PR #5', 'merge request 34', 'MR !34'],
					notFound: ['PR review'],
					pane: 'any',
					need: 'repository',
					forge: 'github',
				},
				{
					id: 'crossRepository',
					patterns: [{ id: 'finds', regex: DetectionPatterns.CROSS_REPOSITORY }],
					found: ['org/lib!7', 'group/sub/app!3'],
					notFound: ['org/lib !7'],
					pane: 'any',
					need: null,
					forge: 'github',
				},
				{
					id: 'bang',
					patterns: [{ id: 'finds', regex: DetectionPatterns.BANG }],
					found: ['merge !34 now', 'see !7'],
					notFound: ['wow!34'],
					pane: 'any',
					need: 'gitlab',
					forge: 'gitlab',
				},
			],
		},
		{
			id: 'tickets',
			rules: [
				{
					id: 'ticket',
					patterns: [{ id: 'finds', regex: DetectionPatterns.TICKET }],
					found: ['ABC-123', 'fix OPS-42'],
					notFound: ['UTF-8', 'abc-123', 'A-1'],
					pane: 'any',
					need: 'ticketAddress',
					forge: 'github',
				},
			],
		},
		{
			id: 'commits',
			rules: [
				{
					id: 'commitAddress',
					patterns: [
						{ id: 'finds', regex: DetectionPatterns.REFERENCE_ADDRESS },
						{ id: 'commitPathGithub', regex: DetectionPatterns.GITHUB_COMMIT_PATH },
						{ id: 'commitPathGitlab', regex: DetectionPatterns.GITLAB_COMMIT_PATH },
					],
					found: ['https://github.com/org/app/commit/26d63ea', 'https://gitlab.com/group/app/-/commit/26d63ea'],
					notFound: ['https://example.com/commit/26d63ea'],
					pane: 'any',
					need: null,
					forge: 'github',
				},
				{
					id: 'commitHash',
					patterns: [{ id: 'finds', regex: DetectionPatterns.COMMIT_HASH }],
					found: ['26d63ea', 'commit 8ceda61d3f'],
					notFound: ['deadbeef', '1234567', 'abc12'],
					pane: 'any',
					need: 'repository',
					forge: 'github',
				},
			],
		},
		{
			id: 'filePaths',
			rules: [
				{
					id: 'filePath',
					patterns: [{ id: 'finds', regex: DetectionPatterns.FILE_PATH }],
					found: [
						'src/app.ts',
						'./lib/x.rs:10:5',
						'app.ts:42',
						'~/Library/WebKit/dev.heidrun-org.heidrun-code.development',
					],
					notFound: ['foo.ts', '1.2.3', 'db.example.com:5432'],
					pane: 'any',
					need: null,
					forge: 'github',
				},
			],
		},
		{
			id: 'shellCommands',
			rules: [
				{
					id: 'inlineShell',
					patterns: [{ id: 'finds', regex: DetectionPatterns.INLINE_SHELL }],
					found: ['run ! pnpm test.', 'lance ! scripts/x.sh.'],
					notFound: ['Super ! Bravo'],
					pane: 'agent',
					need: null,
					forge: 'github',
				},
				{
					id: 'shellBlock',
					patterns: [{ id: 'finds', regex: DetectionPatterns.SHELL_BLOCK_START }],
					found: ['! git status', '! docker builder prune -af &&\n  docker image prune -af'],
					notFound: ['git status'],
					pane: 'claude',
					need: null,
					forge: 'github',
				},
			],
		},
		{
			id: 'slashCommands',
			rules: [
				{
					id: 'slashCommand',
					patterns: [{ id: 'finds', regex: DetectionPatterns.SLASH_COMMAND }],
					found: ['/compact', 'run /compact now'],
					notFound: ['/tmp/x', '/unknown'],
					pane: 'claude',
					need: 'knownCommands',
					forge: 'github',
				},
			],
		},
		{
			id: 'numberedSteps',
			rules: [
				{
					id: 'numberedStep',
					patterns: [{ id: 'finds', regex: DetectionPatterns.NUMBERED_STEP }],
					found: ['1. Open the issue', '2) Commit the change'],
					notFound: ['1. ok', '3.14 is pi'],
					pane: 'agent',
					need: null,
					forge: 'github',
				},
			],
		},
		{
			id: 'agentList',
			rules: [
				{
					id: 'promptBox',
					patterns: [
						{ id: 'boxRule', regex: DetectionPatterns.PROMPT_BOX_RULE },
						{ id: 'agentRow', regex: DetectionPatterns.AGENT_ROW },
					],
					found: ['────────\n❯ \n────────\n  ● main\n❯ ○ worker'],
					notFound: ['────────\n❯ \n────────'],
					pane: 'claude',
					need: null,
					forge: 'github',
				},
				{
					id: 'agentRow',
					patterns: [{ id: 'agentRow', regex: DetectionPatterns.AGENT_ROW }],
					found: ['● main\n○ worker-1'],
					notFound: ['● main'],
					pane: 'claude',
					need: null,
					forge: 'github',
				},
			],
		},
		{
			id: 'questionsAndChoices',
			rules: [
				{
					id: 'question',
					patterns: [{ id: 'endOfQuestion', regex: DetectionPatterns.QUESTION_END }],
					found: ['● Done.\n\nShould I merge?'],
					notFound: ['● Done.\n\nThe change is merged.'],
					pane: 'agent',
					need: null,
					forge: 'github',
				},
				{
					id: 'choices',
					patterns: [{ id: 'option', regex: DetectionPatterns.OPTION }],
					found: ['Do you want to run this command?\n  git status\n❯ 1. Yes\n  2. No'],
					notFound: ['Steps:\n1. Yes\n2. No'],
					pane: 'agent',
					need: null,
					forge: 'github',
				},
			],
		},
	];

	/**
	 * Builds the context of a project that the test uses to run the examples: a repository on the forge, a ticket address
	 * without a list of prefixes, and the slash command `/compact`.
	 *
	 * @param forge - The forge of the project.
	 * @returns The options for `TerminalDetection.detectText`, with every detection family on and a Claude Code pane.
	 */
	static buildStandardOptions(forge: Forge): CatalogOptions {
		const context: RefContext =
			forge === 'github'
				? {
						base: 'https://github.com/org/app',
						origin: 'https://github.com',
						forge: 'github',
						ticketUrl: 'https://tracker.example.com/browse/{key}',
						ticketPrefixes: [],
						enabled: true,
					}
				: {
						base: 'https://gitlab.com/group/app',
						origin: 'https://gitlab.com',
						forge: 'gitlab',
						ticketUrl: 'https://tracker.example.com/browse/{key}',
						ticketPrefixes: [],
						enabled: true,
					};
		return {
			context,
			knownCommands: new Set(['compact']),
			agent: 'claude',
			enabledFamilies: new Set(DETECTION_FAMILY_IDS),
		};
	}

	/**
	 * Runs one example through the real detection and tells whether the rule found something in it.
	 *
	 * @param example - The text of the example. A line break starts a new line of the screen.
	 * @param familyId - The detection family of the rule.
	 * @param ruleId - The identifier of the rule.
	 * @param options - The context of the pane and the switches.
	 * @returns The answer of the detection for this rule.
	 */
	static check(example: string, familyId: DetectionFamilyId, ruleId: string, options: CatalogOptions): CatalogCheck {
		const sample = TerminalDetection.detectText(example, options);
		if (ruleId === 'question') {
			const question = sample.screen?.question ?? null;
			return { isFound: question !== null, text: question, item: null, choiceCount: null };
		}
		if (ruleId === 'choices') {
			const choices = sample.screen?.choices ?? null;
			return {
				isFound: choices !== null,
				text: choices === null ? null : choices.question,
				item: null,
				choiceCount: choices === null ? null : choices.options.length,
			};
		}
		for (const line of sample.lines) {
			for (const item of line.items) {
				if (item.family === familyId && item.rule === ruleId) {
					return { isFound: true, text: item.text, item, choiceCount: null };
				}
			}
		}
		return { isFound: false, text: null, item: null, choiceCount: null };
	}
}
