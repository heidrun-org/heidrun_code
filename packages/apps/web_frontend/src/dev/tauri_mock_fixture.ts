import type { Chat, ChatAgent, ChatMeta, ChatSortKey, ChatSortOrder, ChatUsage } from '../stores/chats';
import type { AgentInfo, AgentStatus, PaneInfo, PaneLayoutSnapshot, SessionSnapshot } from '../lib/types';
import type { AiCostAnswer, AiCostHourRow, AiCostSynchronization, AiCostWorkspace } from '../lib/ai_cost';
import type { PersonWorkItems } from '../lib/person_work';
import type { UserActivityRecord } from '../lib/user_activity';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TauriMockFixture — the fake Herdr session that the browser shows when no Tauri bridge exists
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One fake issue or one fake pull request, as `gh` prints it. */
type FixtureForgeItem = {
	/** The person who opened the item. */
	author: { login: string };
	/** The labels of an issue. A pull request has none. */
	labels?: { name: string; color: string }[];
	/** The other fields of the item: the number, the title, the address, the date, and the branches. */
	[field: string]: unknown;
};

/** The values that describe one pane of the fake Herdr session. */
type FixturePaneOptions = {
	/** The identifier of the pane. */
	paneId: string;
	/** The identifier of the tab that holds the pane. */
	tabId: string;
	/** The identifier of the workspace that holds the tab. */
	workspaceId: string;
	/** True when the pane is the focused pane of its tab. */
	isFocused: boolean;
	/** The status of the agent in the pane. */
	agentStatus: AgentStatus;
	/** The name of the agent program, or null when the pane is a plain terminal. */
	agent: string | null;
	/** The label of the pane. */
	label: string;
	/** The working folder of the pane. */
	cwd: string;
};

/**
 * The fake Herdr session. It has two workspaces, three tabs, and four panes, with every agent status present.
 */
export class TauriMockFixture {
	/** Share of the width that the left pane of the first tab takes. The Herdr request `layout.set_split_ratio` changes it. */
	private static _firstTabRatio = 0.5;

	/**
	 * Sets the share that the first group of a split takes, like the Herdr request `layout.set_split_ratio`.
	 * The fake session has one split only: the one between the two panes of the first tab.
	 *
	 * @param path - The way from the root of the layout to the split. The root split has an empty way.
	 * @param ratio - The new share of the first group. Like Herdr, the fixture keeps it between 0.1 and 0.9.
	 */
	static setSplitRatio(path: boolean[], ratio: number): void {
		if (path.length > 0) {
			throw new Error('split_not_found: split path not found');
		}
		TauriMockFixture._firstTabRatio = Math.min(0.9, Math.max(0.1, ratio));
	}

	/**
	 * The answer of `gh issue list` or `gh pr list`: three fake issues, or two fake pull requests. A search given with
	 * `--search` keeps the items that match its words `author:`, `label:`, and `no:label`, with the minus sign: the
	 * other words are ignored.
	 *
	 * @param args - The arguments of `gh`, for example `['issue', 'list', '--state', 'open', '--json', 'number,title,url']`.
	 * @returns The JSON text that `gh` prints.
	 */
	static buildForgeListAnswer(args: string[]): string {
		const searchIndex = args.indexOf('--search');
		const search = searchIndex === -1 ? '' : args[searchIndex + 1];
		const items = TauriMockFixture._buildForgeItems(args[0] === 'issue');
		return JSON.stringify(items.filter((item) => TauriMockFixture._matchesSearch(item, search)));
	}

	/**
	 * Tells whether a fake item matches the words of a search.
	 *
	 * @param item - The fake issue or pull request.
	 * @param search - The search, in the search language of GitHub.
	 * @returns True when the item matches every word that the fixture knows.
	 */
	private static _matchesSearch(item: FixtureForgeItem, search: string): boolean {
		const labelNames = (item.labels ?? []).map((label) => label.name.toLowerCase());
		return (search.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []).every((word) => {
			const isNegated = word.startsWith('-');
			const [qualifier, rawValue] = (isNegated ? word.slice(1) : word).split(':');
			const value = (rawValue ?? '').replace(/"/g, '').toLowerCase();
			let isMatch = true;
			if (qualifier === 'author') {
				isMatch = item.author.login === (value === '@me' ? 'jeromeetienne' : value);
			} else if (qualifier === 'label') {
				isMatch = labelNames.includes(value);
			} else if (qualifier === 'no' && value === 'label') {
				isMatch = labelNames.length === 0;
			} else {
				return true;
			}
			return isNegated ? isMatch === false : isMatch;
		});
	}

	/**
	 * The fake issues or the fake pull requests.
	 *
	 * @param isIssues - True for the issues, false for the pull requests.
	 * @returns The items, as `gh` prints them.
	 */
	private static _buildForgeItems(isIssues: boolean): FixtureForgeItem[] {
		const baseUrl = 'https://github.com/heidrun-org/heidrun';
		const daysAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString();
		if (isIssues) {
			return [
				{
					number: 370,
					title: 'Add the Code hosting sidebar section: a list of issues and a list of pull requests',
					url: `${baseUrl}/issues/370`,
					author: { login: 'jeromeetienne' },
					createdAt: daysAgo(1),
					labels: [{ name: 'Design', color: '1d76db' }, { name: 'Simple Work', color: '2ea043' }],
				},
				{
					number: 366,
					title: 'Show the branch of each pane in the status bar',
					url: `${baseUrl}/issues/366`,
					author: { login: 'erictang' },
					createdAt: daysAgo(3),
					labels: [],
				},
				{
					number: 351,
					title: 'A very long title that does not fit in the width of the left sidebar, so that the end of it is cut',
					url: `${baseUrl}/issues/351`,
					author: { login: 'jeromeetienne' },
					createdAt: daysAgo(40),
					labels: [{ name: 'A very long label name that does not fit either', color: 'd4c5f9' }, { name: 'Bug', color: 'd73a4a' }],
				},
			];
		}
		return [
			{
				number: 369,
				title: 'Move the Needs you sidebar section to the right sidebar',
				url: `${baseUrl}/pull/369`,
				author: { login: 'jeromeetienne' },
				createdAt: daysAgo(0.1),
				isDraft: false,
				headRefName: 'move-to-handle-to-the-right-sidebar-251',
				baseRefName: 'dev_jerome',
			},
			{
				number: 365,
				title: 'Merge dev into main',
				url: `${baseUrl}/pull/365`,
				author: { login: 'erictang' },
				createdAt: daysAgo(2),
				isDraft: true,
				headRefName: 'dev',
				baseRefName: 'main',
			},
		];
	}

	/**
	 * The answer of `gh issue view` or `gh pr view` for one number. The issue 123 fails, so the card shows the failure.
	 *
	 * @param args - The arguments of `gh`, for example `['issue', 'view', '250', '--json', 'title,state']`.
	 * @returns The JSON text that `gh` prints.
	 */
	static buildForgeAnswer(args: string[]): string {
		const isIssue = args[0] === 'issue';
		const number = Number(args[2]);
		if (number === 123) {
			throw new Error('mock: GraphQL: Could not resolve to an issue or pull request with the number of 123.');
		}
		const isOpen = number % 3 === 0;
		const state = isIssue ? (isOpen ? 'OPEN' : 'CLOSED') : isOpen ? 'OPEN' : 'MERGED';
		return JSON.stringify({
			title: isIssue
				? 'Add a Chats section to the right sidebar, with the saved conversations of Claude Code and Codex'
				: 'Move the Needs you sidebar section from the left sidebar to the right sidebar',
			state,
			body: isIssue
				? '## Goal\n\nMove the Needs you sidebar section from the left sidebar to the right sidebar. The Pane sidebar section stays where it is, and the **Notes** section moves too.'
				: 'The Needs you sidebar section now belongs to the right sidebar, with the Pane sidebar section.',
			labels: isIssue ? [{ name: 'Simple Work', color: '2ea043' }, { name: 'Design', color: '1d76db' }] : [],
			author: { login: 'jeromeetienne' },
			createdAt: '2026-10-11T09:30:00Z',
			...(isIssue ? {} : { headRefName: 'move-to-handle-to-the-right-sidebar-251', baseRefName: 'dev_jerome' }),
		});
	}

	/**
	 * The answer of the Tauri command `chat_references_find`: the stored rows of the issues and of the pull requests whose
	 * numbers are asked. The number 123 has no row, so the card shows that GitHub does not know it.
	 *
	 * @param issueNumbers - The numbers of the issues.
	 * @param pullRequestNumbers - The numbers of the pull requests.
	 * @returns The rows, in the shape that the data layer stores them.
	 */
	static buildStoredReferences(issueNumbers: number[], pullRequestNumbers: number[]): { issues: unknown[]; pullRequests: unknown[] } {
		const rowOf = (number: number, kind: 'issue' | 'pr'): unknown[] => {
			if (number === 123) {
				return [];
			}
			const answer = JSON.parse(TauriMockFixture.buildForgeAnswer([kind, 'view', String(number)])) as {
				title: string;
				state: string;
				body: string;
				labels: { name: string; color: string }[];
				author: { login: string };
				createdAt: string;
				headRefName?: string;
				baseRefName?: string;
			};
			return [
				{
					number,
					title: answer.title,
					state: answer.state,
					body: answer.body,
					author: answer.author.login,
					labels: answer.labels.map((label) => label.name),
					labelColors: Object.fromEntries(answer.labels.map((label) => [label.name, label.color])),
					createdAt: answer.createdAt,
					...(kind === 'pr' ? { headRefName: answer.headRefName, baseRefName: answer.baseRefName } : {}),
				},
			];
		};
		return {
			issues: issueNumbers.flatMap((number) => rowOf(number, 'issue')),
			pullRequests: pullRequestNumbers.flatMap((number) => rowOf(number, 'pr')),
		};
	}

	/** The translation table of the clustered dynamic topics that the mock keeps, as the file on the disk does. */
	private static _topicClusterRows: Record<string, string> = {};

	/**
	 * The translation table of the clustered dynamic topics.
	 *
	 * @returns A copy of the rows that the last call of `setTopicClusterRows` saved.
	 */
	static getTopicClusterRows(): Record<string, string> {
		return { ...TauriMockFixture._topicClusterRows };
	}

	/**
	 * Replaces the translation table of the clustered dynamic topics.
	 *
	 * @param rows - The cluster of each raw dynamic topic.
	 * @returns Nothing.
	 */
	static setTopicClusterRows(rows: Record<string, string>): void {
		TauriMockFixture._topicClusterRows = { ...rows };
	}

	/** The content of the file `.heidrun/config.json` of the fake project, which the mock keeps as the file on the disk does. */
	private static _projectConfig: unknown = { version: 1, launchers: [] };

	/**
	 * The answer of the Tauri command `project_load`: the fake project, with the configuration that the last call of
	 * `setProjectConfig` saved.
	 *
	 * @param cwd - The folder of the workspace.
	 * @returns The root, the path of the configuration file, the configuration, and no detected command.
	 */
	static buildProject(cwd: string): unknown {
		return {
			root: cwd,
			config_path: `${cwd}/.heidrun/config.json`,
			config: JSON.parse(JSON.stringify(TauriMockFixture._projectConfig)),
			detected: [],
		};
	}

	/**
	 * Replaces the configuration of the fake project, as the Tauri command `project_save` does.
	 *
	 * @param config - The new content of the file `.heidrun/config.json`.
	 * @returns Nothing.
	 */
	static setProjectConfig(config: unknown): void {
		TauriMockFixture._projectConfig = JSON.parse(JSON.stringify(config));
	}

	/** The content of the file `launchers.json` of the user level launchers, which the mock keeps as the file on the disk does. */
	private static _userLaunchers: unknown[] = [];

	/**
	 * The answer of the Tauri command `launchers_user_read`: the user level launchers that the last call of
	 * `setUserLaunchers` saved.
	 * - issue #853
	 *
	 * @returns The file as the desktop application reads it: it exists, it holds the launchers, and it has no error.
	 */
	static buildUserLaunchersFile(): unknown {
		return {
			exists: true,
			launchers: JSON.parse(JSON.stringify(TauriMockFixture._userLaunchers)),
			error: null,
		};
	}

	/**
	 * Replaces the user level launchers, as the Tauri command `launchers_user_write` does.
	 * - issue #853
	 *
	 * @param launchers - The new content of the file `launchers.json`.
	 * @returns Nothing.
	 */
	static setUserLaunchers(launchers: unknown[]): void {
		TauriMockFixture._userLaunchers = JSON.parse(JSON.stringify(launchers));
	}

	/**
	 * The answer of the Tauri command `git_status`: one staged file and one changed file, as in the screenshots of the
	 * Source control sidebar section.
	 * - issue #305
	 *
	 * @returns The Git status of the repository of the fake workspace.
	 */
	static buildGitStatus(): unknown {
		return {
			root: '/Users/demo/webwork/heidrun',
			branch: 'dev_jerome',
			upstream: 'origin/dev_jerome',
			ahead: 1,
			behind: 0,
			changed: 2,
			untracked: 0,
			files: [
				{
					status: 'M.',
					path: 'docs/agents_rules/user_interface.md',
				},
				{
					status: '.M',
					path: 'CHANGELOG.md',
				},
			],
			last_sha: 'f853124',
			last_subject: 'Merge pull request #294',
			last_time: null,
			remote: null,
		};
	}

	/**
	 * The answer of the Tauri command `user_activity_records_in_range`: fake active periods in the last 30 days, in UTC, as the
	 * data layer gives them. Seven periods are in the last hour, and the last two minutes
	 * have no period. Four more periods fall on each of the 30 days, from three hours
	 * before the end of the time range, and they are 20 to 55 minutes long. Each period belongs to one of three folders: the
	 * folder of the first workspace for three periods of every five, the folder of the second workspace for one period of
	 * every five, and the folder of a worktree that was removed for the last one, so that the histogram has workspaces to
	 * choose.
	 * - issue #473
	 * - issue #486
	 *
	 * @param until - The end of the time range, in milliseconds since 1 January 1970.
	 * @returns The fake user activity records, the oldest first.
	 */
	static buildUserActivityRecords(until: number): UserActivityRecord[] {
		const secondsBeforeUntil: [number, number][] = [
			[56 * 60, 54 * 60 + 20],
			[51 * 60, 47 * 60 + 30],
			[44 * 60, 43 * 60],
			[31 * 60 + 40, 26 * 60 + 10],
			[19 * 60, 16 * 60 + 50],
			[9 * 60 + 30, 9 * 60],
			[4 * 60, 2 * 60 + 30],
		];
		for (let dayIndex = 0; dayIndex < 30; dayIndex += 1) {
			for (let sessionIndex = 0; sessionIndex < 4; sessionIndex += 1) {
				const startedBefore = dayIndex * 24 * 3600 + (3 + 3 * sessionIndex) * 3600;
				const lengthMinutes = 20 + ((dayIndex * 7 + sessionIndex * 11) % 36);
				secondsBeforeUntil.push([startedBefore, startedBefore - lengthMinutes * 60]);
			}
		}
		secondsBeforeUntil.sort((first, second) => second[0] - first[0]);
		const workspaceFolders = [
			'/Users/demo/webwork/heidrun',
			'/Users/demo/webwork/heidrun',
			'/Users/demo/webwork/website',
			'/Users/demo/webwork/heidrun',
			'/Users/demo/webwork/heidrun/.claude/worktrees/removed-fix-info-card-252',
		];
		return secondsBeforeUntil.map(([startedBefore, endedBefore], index) => ({
			workspaceFolder: workspaceFolders[index % workspaceFolders.length],
			startedAt: new Date(until - startedBefore * 1000).toISOString(),
			lastActionAt: new Date(until - endedBefore * 1000).toISOString(),
			endedAt: new Date(until - endedBefore * 1000).toISOString(),
			keyboardActionCount: 40,
			mouseActionCount: 12,
			endReason: 'cool_down',
		}));
	}

	/**
	 * The answer of the Tauri command `person_work_in_range`: the fake work of two people in the last 30 days. Jérôme
	 * Étienne writes one to five commits each day and opens a pull request every other day, and his login on GitHub is
	 * `jerome-etienne`. He opens an issue every fifth day. Eric writes a commit every third day, and opens nothing on GitHub.
	 * Each commit adds and deletes some lines.
	 * - issue #482
	 * - issue #523
	 *
	 * @param until - The end of the time range, in milliseconds since 1 January 1970: the next midnight.
	 * @returns The fake commits, pull requests, and issues, the oldest first, and no error of GitHub.
	 */
	static buildPersonWorkItems(until: number): PersonWorkItems {
		const dayMs = 24 * 3600 * 1000;
		const result: PersonWorkItems = {
			repository: 'heidrun-org/heidrun',
			commits: [],
			pullRequests: [],
			issues: [],
			codeHostingError: null,
		};
		for (let daysBefore = 29; daysBefore >= 0; daysBefore -= 1) {
			const dayEnd = until - daysBefore * dayMs;
			const commitCount = 1 + ((daysBefore * 3 + 2) % 5);
			for (let index = 0; index < commitCount; index += 1) {
				result.commits.push({
					authorName: 'Jérôme Étienne',
					authorEmail: 'jerome@example.com',
					committedAt: new Date(dayEnd - (3 + index) * 3600 * 1000).toISOString(),
					insertions: 20 + ((daysBefore * 7 + index * 13) % 80),
					deletions: 5 + ((daysBefore * 5 + index * 11) % 40),
				});
			}
			if (daysBefore % 3 === 0) {
				result.commits.push({
					authorName: 'Eric',
					authorEmail: 'eric@example.com',
					committedAt: new Date(dayEnd - 2 * 3600 * 1000).toISOString(),
					insertions: 15,
					deletions: 4,
				});
			}
			if (daysBefore % 2 === 0) {
				result.pullRequests.push({
					author: 'jerome-etienne',
					createdAt: new Date(dayEnd - 5 * 3600 * 1000).toISOString(),
				});
			}
			if (daysBefore % 5 === 0) {
				result.issues.push({
					author: 'jerome-etienne',
					createdAt: new Date(dayEnd - 6 * 3600 * 1000).toISOString(),
				});
			}
		}
		result.commits.sort((first, second) => first.committedAt.localeCompare(second.committedAt));
		return result;
	}

	/** The folders whose fake history the Tauri command `ai_cost_synchronize` imported. */
	private static readonly _importedAiCostFolders = new Set<string>();

	/**
	 * Forgets the imported folders, so that the next read of the AI cost finds every workspace not imported, as a new
	 * installation does.
	 */
	static resetAiCostImports(): void {
		TauriMockFixture._importedAiCostFolders.clear();
	}

	/**
	 * The state of the workspaces for the AI cost: a folder is imported after `ai_cost_synchronize` imported it.
	 *
	 * @param folders - The folders that the caller asked for.
	 * @returns One state for each folder.
	 */
	private static _buildAiCostWorkspaces(folders: string[]): AiCostWorkspace[] {
		return folders.map((folder) => ({
			folder,
			repository: 'heidrun-org/heidrun',
			synchronizedAt: TauriMockFixture._importedAiCostFolders.has(folder) ? new Date().toISOString() : null,
			error: null,
		}));
	}

	/**
	 * The answer of the Tauri command `ai_cost_synchronize`. A folder that was not imported is imported only when the caller
	 * allows it.
	 *
	 * @param folders - The folders of the workspaces.
	 * @param isImportAllowed - True when the developer pressed the button "Import the history".
	 * @returns The state of each workspace, and no warning about the prices.
	 */
	static buildAiCostSynchronization(folders: string[], isImportAllowed: boolean): AiCostSynchronization {
		if (isImportAllowed === true) {
			for (const folder of folders) {
				TauriMockFixture._importedAiCostFolders.add(folder);
			}
		}
		return { workspaces: TauriMockFixture._buildAiCostWorkspaces(folders), priceWarning: null };
	}

	/**
	 * The answer of the Tauri command `ai_cost_in_range`: the fake tokens and costs of the last 30 days, one row for each coding
	 * agent and each hour that had tokens. A dollar of cost is 400,000 tokens. The rows exist only when at least one asked folder
	 * is imported. Claude Code costs 1 to 5 dollars each day, with a few cents more from a small chat, and every fourth day a
	 * longer chat goes on after midnight and costs money on the next day too. Codex costs under 2 dollars every other day. One
	 * day of Codex has no known price. The cost of a day is spread over the hours of work of the day, so the sum of the hours of a
	 * day is the cost of that day.
	 * - issue #482
	 * - issue #616
	 *
	 * @param folders - The folders of the workspaces.
	 * @param until - The end of the time range, in milliseconds since 1 January 1970: the next midnight.
	 * @returns The state of the workspaces and the rows, the oldest first.
	 */
	static buildAiCostAnswer(folders: string[], until: number): AiCostAnswer {
		const workspaces = TauriMockFixture._buildAiCostWorkspaces(folders);
		const answer: AiCostAnswer = { workspaces, hours: [], priceVersion: 1, pricesCheckedAt: new Date().toISOString() };
		if (workspaces.every((workspace) => workspace.synchronizedAt === null)) {
			return answer;
		}
		const end = new Date(until);
		const workHours: Record<string, number[]> = { claude: [9, 10, 11, 13, 14, 15, 16, 17], codex: [11, 12, 16] };
		const rows = (daysBefore: number, codingAgent: string, costUsd: number | null): AiCostHourRow[] => {
			const dayStart = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (daysBefore + 1));
			const dayTokens = Math.round((costUsd ?? 0.5) * 400_000);
			const day = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, '0')}-${String(dayStart.getDate()).padStart(2, '0')}`;
			const hours = workHours[codingAgent];
			const weights = hours.map((_, index) => 1 + ((daysBefore + index * 3) % 4));
			const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
			let tokensGiven = 0;
			return hours.map((hour, index) => {
				const tokens = index === hours.length - 1 ? dayTokens - tokensGiven : Math.floor((dayTokens * weights[index]) / totalWeight);
				tokensGiven += tokens;
				return {
					startedAt: new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), hour).toISOString(),
					day,
					codingAgent,
					tokens,
					costUsd: costUsd === null ? null : (costUsd * tokens) / dayTokens,
					unpricedTokens: costUsd === null ? tokens : 0,
				};
			});
		};
		for (let daysBefore = 29; daysBefore >= 0; daysBefore -= 1) {
			const longChatYesterday = (daysBefore + 1) % 4 === 2 ? 2 : 0;
			const longChatToday = daysBefore % 4 === 2 ? 2.5 : 0;
			const claudeCost = 1 + ((daysBefore * 7 + 3) % 5) + 0.02 + (daysBefore % 4) * 0.01 + longChatToday + longChatYesterday;
			const codexCost = daysBefore === 7 ? null : 0.3 + (daysBefore % 5) * 0.3;
			const dayRows = [...rows(daysBefore, 'claude', claudeCost), ...(daysBefore % 2 === 1 ? rows(daysBefore, 'codex', codexCost) : [])];
			answer.hours.push(...dayRows.sort((first, second) => first.startedAt.localeCompare(second.startedAt)));
		}
		return answer;
	}

	/**
	 * The answer of the Tauri command `coding_agent_ask`. There is no coding agent in a browser, so the mock answers two
	 * kinds of prompt. For the prompt of the clustered dynamic topics, it groups the new labels that start with the same
	 * four letters under the shortest of them, for example "sidebar" and "sidebars" under "sidebar". For the prompt of the
	 * method "Language model", it gives each conversation the first two words of its title that have at least five
	 * letters, in lower case, or the topic "general" when the title has none.
	 *
	 * @param prompt - The prompt, which ends with the line `New labels: ["a","b"]` or with the line `Conversations: [...]`.
	 * @returns The coding agent that answered, and the JSON array that it printed.
	 */
	static buildCodingAgentAnswer(prompt: string): { agent: string; text: string } {
		const conversationsLine = prompt.split('\n').find((candidate) => candidate.startsWith('Conversations: '));
		if (conversationsLine !== undefined) {
			const conversations = JSON.parse(conversationsLine.slice('Conversations: '.length)) as {
				conversation: number;
				title: string;
			}[];
			const conversationItems = conversations.map(({ conversation, title }) => {
				const words = (title.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((word, index, list) => list.indexOf(word) === index);
				return { conversation, topics: words.length === 0 ? ['general'] : words.slice(0, 2) };
			});
			return { agent: 'codex', text: JSON.stringify(conversationItems) };
		}
		const line = prompt.split('\n').find((candidate) => candidate.startsWith('New labels: ')) ?? 'New labels: []';
		const newTopics = JSON.parse(line.slice('New labels: '.length)) as string[];
		const items = newTopics.map((topic) => {
			const group = newTopics.filter((other) => other.slice(0, 4) === topic.slice(0, 4));
			const cluster = group.reduce((shortest, other) => (other.length < shortest.length ? other : shortest));
			return { topic, cluster };
		});
		return { agent: 'codex', text: JSON.stringify(items) };
	}

	/**
	 * Builds the answer of the Tauri command `chats_list`: the same fake conversations for every folder, sorted as asked.
	 * Claude has 60 conversations, so that the list needs the button "Show more". Codex has two.
	 *
	 * @param limit - The number of conversations to return for each coding agent.
	 * @param sortKey - What the conversations are sorted by.
	 * @param order - "descending" puts the largest value of the sort key first, and "ascending" puts the smallest value first.
	 * @returns A new object each call, with the first conversations of Claude and of Codex.
	 */
	static buildChats(
		limit: number,
		sortKey: ChatSortKey = 'last_updated',
		order: ChatSortOrder = 'descending',
	): Record<ChatAgent, { chats: Chat[]; has_more: boolean }> & { root: string } {
		const now = Date.now();
		const buildChat = (
			id: string,
			title: string,
			minutesAgo: number,
			meta: Partial<ChatMeta> = {},
			usage: ChatUsage | null = null,
		): Chat => ({
			id,
			title,
			updated_at: now - minutesAgo * 60_000,
			usage,
			meta: {
				first_at: now - (minutesAgo + 90) * 60_000,
				last_at: now - minutesAgo * 60_000,
				user_messages: 0,
				first_messages: [],
				folders: [],
				issues: [],
				pull_requests: [],
				files_written: [],
				...meta,
			},
		});
		const claudeChats: Chat[] = [
			buildChat('claude_1', 'Workspace conversation navigation', 2, {
				user_messages: 10,
				first_messages: [
					'Add a Chats section to the right sidebar, with the saved conversations of Claude Code and Codex.',
					'Each row has a title and three lines of summary: the dates, the issues and the pull requests, and the files.',
					'Can you make the information card wider? Then read the full text of this very long message that stops after three hundred characters, so that the card shows how a long message is cut.',
				],
				issues: [250, 251],
				files_written: [
					'/Users/demo/webwork/heidrun/packages/apps/desktop_tauri/src/chats.rs',
					'/Users/demo/webwork/heidrun/packages/apps/desktop_tauri/src/chats_scan.rs',
					'/Users/demo/webwork/heidrun/.claude/worktrees/add-chats-sidebar-section-250/packages/apps/web_frontend/src/components/ChatsPanel.vue',
					'/Users/demo/webwork/heidrun/packages/apps/web_frontend/src/components/InformationCard.vue',
					'/Users/demo/webwork/heidrun/packages/apps/web_frontend/src/components/OldCard.vue',
					'/Users/demo/webwork/heidrun/AGENTS.md',
					'/Users/demo/webwork/heidrun/.claude/worktrees/removed-fix-info-card-252/AGENTS.md',
					'/Users/demo/webwork/heidrun/docs/agents_rules/user_interface.md',
					'/Users/demo/webwork/heidrun/packages/apps/web_frontend/src/i18n/locales/fr/a_folder_with_many_levels/that_does_not_fit_in/the_information_card/at_all/notes.md',
					'/Users/demo/notes/scratch.md',
					'/private/tmp/claude-501/-Users-demo-webwork-heidrun/e957b92e-4848-4b5b-849e-6618a7a326fd/scratchpad/issue_31_comment.md',
				],
			},
			{ input_tokens: 3_218_500, cached_input_tokens: 3_035_392, output_tokens: 3_287, cost_usd: 4.52 }),
			buildChat('claude_2', 'Tab drag-drop with image drop support', 90, {
				first_at: now - 3_000 * 60_000,
				user_messages: 4,
				issues: [104, 247],
				pull_requests: [230, 249],
			}, { input_tokens: 48_000, cached_input_tokens: 0, output_tokens: 1_900, cost_usd: null }),
			buildChat('claude_3', 'Fix the border of the tab bar when the window is narrow and the pinned panes column is wide', 400, {
				user_messages: 1,
				issues: [1, 2, 3, 4, 5, 6],
				pull_requests: [7],
				files_written: ['/Users/demo/webwork/heidrun/packages/apps/web_frontend/src/components/TabBar.vue'],
			}),
			buildChat('claude_4', 'Issue #251', 1_500, { user_messages: 2, issues: [251], pull_requests: [230, 249, 253] }),
			buildChat('claude_5', 'Herdr interface description', 3_000),
		];
		for (let index = 6; index <= 60; index++) {
			claudeChats.push(buildChat(`claude_${index}`, `Fake chat number ${index}`, 3_000 + index * 60));
		}
		const codexChats: Chat[] = [
			buildChat('codex_1', 'Describe image contents', 30, { user_messages: 1 }, {
				input_tokens: 134_683,
				cached_input_tokens: 132_864,
				output_tokens: 84,
				cost_usd: 0.0031,
			}),
			buildChat('codex_2', 'Count up to 200', 600),
		];
		const cut = (chats: Chat[]) => {
			const sortedChats = TauriMockFixture._sortChats(chats, sortKey, order);
			return {
				chats: sortedChats.slice(0, limit),
				has_more: sortedChats.length > limit,
			};
		};
		return {
			root: '/Users/demo/webwork/heidrun',
			claude: cut(claudeChats),
			codex: cut(codexChats),
		};
	}

	/**
	 * Builds the snapshot that the Herdr request `session.snapshot` returns.
	 *
	 * @returns A new snapshot object each call, so that the application can change it freely.
	 */
	static buildSnapshot(): SessionSnapshot {
		const heidrunFolder = '/Users/demo/webwork/heidrun';
		const websiteFolder = '/Users/demo/webwork/website';

		const panesList: AgentInfo[] = [
			TauriMockFixture._buildPane({
				paneId: 'pane_1',
				tabId: 'tab_1',
				workspaceId: 'workspace_1',
				isFocused: true,
				agentStatus: 'working',
				agent: 'claude',
				label: 'Migrate to Bootstrap',
				cwd: heidrunFolder,
			}),
			TauriMockFixture._buildPane({
				paneId: 'pane_2',
				tabId: 'tab_1',
				workspaceId: 'workspace_1',
				isFocused: false,
				agentStatus: 'blocked',
				agent: 'codex',
				label: 'Review the pull request',
				cwd: heidrunFolder,
			}),
			TauriMockFixture._buildPane({
				paneId: 'pane_3',
				tabId: 'tab_2',
				workspaceId: 'workspace_1',
				isFocused: true,
				agentStatus: 'idle',
				agent: null,
				label: 'Terminal',
				cwd: heidrunFolder,
			}),
			TauriMockFixture._buildPane({
				paneId: 'pane_4',
				tabId: 'tab_3',
				workspaceId: 'workspace_2',
				isFocused: true,
				agentStatus: 'done',
				agent: 'claude',
				label: 'Fix the footer',
				cwd: websiteFolder,
			}),
		];

		const leftWidth = Math.round(200 * TauriMockFixture._firstTabRatio);
		const layoutsList: PaneLayoutSnapshot[] = [
			{
				workspace_id: 'workspace_1',
				tab_id: 'tab_1',
				zoomed: false,
				area: {
					x: 0,
					y: 0,
					width: 200,
					height: 50,
				},
				focused_pane_id: 'pane_1',
				panes: [
					{
						pane_id: 'pane_1',
						focused: true,
						rect: {
							x: 0,
							y: 0,
							width: leftWidth,
							height: 50,
						},
					},
					{
						pane_id: 'pane_2',
						focused: false,
						rect: {
							x: leftWidth,
							y: 0,
							width: 200 - leftWidth,
							height: 50,
						},
					},
				],
				splits: [
					{
						id: 'split_0_root',
						direction: 'right',
						ratio: TauriMockFixture._firstTabRatio,
						rect: {
							x: 0,
							y: 0,
							width: 200,
							height: 50,
						},
					},
				],
			},
			TauriMockFixture._buildSinglePaneLayout('workspace_1', 'tab_2', 'pane_3'),
			TauriMockFixture._buildSinglePaneLayout('workspace_2', 'tab_3', 'pane_4'),
		];

		const snapshot: SessionSnapshot = {
			version: '0.0.0-mock',
			protocol: 1,
			focused_workspace_id: 'workspace_1',
			focused_tab_id: 'tab_1',
			focused_pane_id: 'pane_1',
			workspaces: [
				{
					workspace_id: 'workspace_1',
					workspace_folder: heidrunFolder,
					number: 1,
					label: 'heidrun',
					focused: true,
					pane_count: 3,
					tab_count: 2,
					active_tab_id: 'tab_1',
					agent_status: 'blocked',
					worktree: {
						branch: 'dev_jerome',
						checkout_path: heidrunFolder,
					},
				},
				{
					workspace_id: 'workspace_2',
					workspace_folder: websiteFolder,
					number: 2,
					label: 'website',
					focused: false,
					pane_count: 1,
					tab_count: 1,
					active_tab_id: 'tab_3',
					agent_status: 'done',
				},
			],
			tabs: [
				{
					tab_id: 'tab_1',
					workspace_id: 'workspace_1',
					number: 1,
					label: 'agents',
					focused: true,
					pane_count: 2,
					agent_status: 'blocked',
				},
				{
					tab_id: 'tab_2',
					workspace_id: 'workspace_1',
					number: 2,
					label: 'terminal',
					focused: false,
					pane_count: 1,
					agent_status: 'idle',
				},
				{
					tab_id: 'tab_3',
					workspace_id: 'workspace_2',
					number: 1,
					label: 'main',
					focused: true,
					pane_count: 1,
					agent_status: 'done',
				},
			],
			panes: panesList,
			layouts: layoutsList,
			agents: panesList.filter((paneInfo) => paneInfo.agent !== null),
		};
		return snapshot;
	}

	/**
	 * Builds the text that the Herdr request `pane.read` returns.
	 *
	 * @param paneId - The identifier of the pane to read.
	 * @returns The last lines of the terminal of the pane.
	 */
	static readPaneText(paneId: string): string {
		const textLinesList = [
			`$ pnpm test  # pane ${paneId}`,
			'',
			' RUN  v2.1.9',
			' ✓ src/lib/format.test.ts (12)',
			' ✓ src/lib/diff.test.ts (8)',
			'',
			' Test Files  2 passed (2)',
			'      Tests  20 passed (20)',
		];
		return textLinesList.join('\n');
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Sorts fake conversations the way the Rust command does: by the value of the sort key, then the newest file first.
	 *
	 * @param chats - The conversations to sort. The array is not changed.
	 * @param sortKey - What the conversations are sorted by.
	 * @param order - "descending" puts the largest value first, and "ascending" puts the smallest value first.
	 * @returns A new array with the conversations in order.
	 */
	private static _sortChats(chats: Chat[], sortKey: ChatSortKey, order: ChatSortOrder): Chat[] {
		const valueOf = (chat: Chat): number => {
			switch (sortKey) {
				case 'created_on':
					return chat.meta.first_at ?? chat.updated_at;
				case 'last_updated':
					return chat.updated_at;
				case 'messages':
					return chat.meta.user_messages;
				case 'issues':
					return chat.meta.issues.length;
				case 'pull_requests':
					return chat.meta.pull_requests.length;
				case 'files_written':
					return chat.meta.files_written.length;
			}
		};
		const direction = order === 'descending' ? -1 : 1;
		return [...chats].sort((a, b) => {
			const byValue = (valueOf(a) - valueOf(b)) * direction;
			return byValue !== 0 ? byValue : b.updated_at - a.updated_at;
		});
	}

	/**
	 * Builds one pane, with the fields that the application reads.
	 *
	 * @param options - The values that describe the pane.
	 * @returns The pane, as the agent list of the snapshot holds it.
	 */
	private static _buildPane(options: FixturePaneOptions): AgentInfo {
		const paneInfo: PaneInfo = {
			pane_id: options.paneId,
			terminal_id: `terminal_${options.paneId}`,
			workspace_id: options.workspaceId,
			tab_id: options.tabId,
			focused: options.isFocused,
			agent_status: options.agentStatus,
			revision: 1,
			agent: options.agent,
			display_agent: options.agent,
			label: options.label,
			title: options.label,
			cwd: options.cwd,
			foreground_cwd: options.cwd,
			terminal_title: options.label,
			terminal_title_stripped: options.label,
		};
		const agentInfo: AgentInfo = {
			...paneInfo,
			name: options.label,
			state_change_seq: 1,
			interactive_ready: true,
		};
		return agentInfo;
	}

	/**
	 * Builds the layout of a tab that holds one pane.
	 *
	 * @param workspaceId - The identifier of the workspace that holds the tab.
	 * @param tabId - The identifier of the tab.
	 * @param paneId - The identifier of the only pane of the tab.
	 * @returns The layout of the tab.
	 */
	private static _buildSinglePaneLayout(workspaceId: string, tabId: string, paneId: string): PaneLayoutSnapshot {
		const layout: PaneLayoutSnapshot = {
			workspace_id: workspaceId,
			tab_id: tabId,
			zoomed: false,
			area: {
				x: 0,
				y: 0,
				width: 200,
				height: 50,
			},
			focused_pane_id: paneId,
			panes: [
				{
					pane_id: paneId,
					focused: true,
					rect: {
						x: 0,
						y: 0,
						width: 200,
						height: 50,
					},
				},
			],
		};
		return layout;
	}
}
