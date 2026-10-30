import { invoke } from '@tauri-apps/api/core';
import { clearMocks } from '@tauri-apps/api/mocks';
import { afterEach, describe, expect, it } from 'vitest';
import type { AiCostAnswer, AiCostSynchronization } from '../lib/ai_cost';
import type { PersonWorkItems } from '../lib/person_work';
import type { SessionSnapshot } from '../lib/types';
import { TauriMock } from './tauri_mock';
import { TauriMockFixture } from './tauri_mock_fixture';

const tauriWindow = window as unknown as { __TAURI_INTERNALS__?: unknown };

describe('TauriMock', () => {
	afterEach(() => {
		clearMocks();
		delete tauriWindow.__TAURI_INTERNALS__;
		TauriMockFixture.setSplitRatio([], 0.5);
	});

	it('installs nothing on the Mire page of a device of the local network, so that no fake answer shows there (issue 978)', () => {
		window.history.replaceState(null, '', '/mire');
		TauriMock.install();
		expect(tauriWindow.__TAURI_INTERNALS__).toBe(undefined);
		window.history.replaceState(null, '', '/');
		TauriMock.install();
		expect(tauriWindow.__TAURI_INTERNALS__).not.toBe(undefined);
	});

	it('answers the Herdr request session.snapshot with the fake Herdr session', async () => {
		TauriMock.install();
		const result = await invoke<{ snapshot: SessionSnapshot }>('herdr_request', {
			method: 'session.snapshot',
			params: {},
		});
		expect(result.snapshot.workspaces.length).toBe(2);
		expect(result.snapshot.panes.length).toBe(4);
	});

	it('moves the line between the two panes of the first tab with the Herdr request layout.set_split_ratio', async () => {
		TauriMock.install();
		await invoke('herdr_request', {
			method: 'layout.set_split_ratio',
			params: {
				tab_id: 'tab_1',
				path: [],
				ratio: 0.25,
			},
		});
		const result = await invoke<{ snapshot: SessionSnapshot }>('herdr_request', {
			method: 'session.snapshot',
			params: {},
		});
		const layout = result.snapshot.layouts.find((candidate) => candidate.tab_id === 'tab_1');
		expect(layout?.splits?.[0].ratio).toBe(0.25);
		expect(layout?.panes[0].rect.width).toBe(50);
		expect(layout?.panes[1].rect.x).toBe(50);
	});

	it('answers the Tauri command chats_list with the newest fake conversations of Claude and of Codex, up to the limit', async () => {
		TauriMock.install();
		type AgentChats = { chats: { id: string; title: string }[]; has_more: boolean };
		const result = await invoke<Record<'claude' | 'codex', AgentChats>>('chats_list', {
			folder: '/Users/demo/webwork/heidrun',
			limit: 5,
		});
		expect(result.claude.chats.length).toBe(5);
		expect(result.claude.has_more).toBe(true);
		expect(result.codex.chats.length).toBe(2);
		expect(result.codex.has_more).toBe(false);
		const everything = await invoke<Record<'claude' | 'codex', AgentChats>>('chats_list', {
			folder: '/Users/demo/webwork/heidrun',
			limit: 1000,
		});
		expect(everything.claude.chats.length).toBe(60);
		expect(everything.claude.has_more).toBe(false);
	});

	it('sorts the fake conversations of the Tauri command chats_list by the sort key and the order that it receives', async () => {
		TauriMock.install();
		type Answer = Record<'claude' | 'codex', { chats: { id: string }[]; has_more: boolean }>;
		const firstClaudeId = async (sortKey: string, order: string) => {
			const result = await invoke<Answer>('chats_list', { folder: '/x', limit: 3, sortKey, order });
			return result.claude.chats.map((chat) => chat.id);
		};
		expect(await firstClaudeId('last_updated', 'descending')).toEqual(['claude_1', 'claude_2', 'claude_3']);
		expect(await firstClaudeId('messages', 'descending')).toEqual(['claude_1', 'claude_2', 'claude_4']);
		expect(await firstClaudeId('messages', 'ascending')).toEqual(['claude_5', 'claude_6', 'claude_7']);
		expect(await firstClaudeId('issues', 'descending')).toEqual(['claude_3', 'claude_1', 'claude_2']);
		expect((await firstClaudeId('pull_requests', 'descending'))[0]).toBe('claude_4');
		expect((await firstClaudeId('files_written', 'descending'))[0]).toBe('claude_1');
		expect((await firstClaudeId('created_on', 'ascending'))[0]).toBe('claude_60');
		const withoutSort = await invoke<Answer>('chats_list', { folder: '/x', limit: 1 });
		expect(withoutSort.claude.chats[0].id).toBe('claude_1');
	});

	it('answers the cached forge command with the JSON of an issue and of a pull request, and fails for the issue 123', async () => {
		TauriMock.install();
		const issue = JSON.parse(
			await invoke<string>('forge_cli_cached', { cwd: '/x', tool: 'gh', args: ['issue', 'view', '250', '--json', 'title'] }),
		);
		expect(issue.title).toContain('Chats');
		expect(issue.headRefName).toBeUndefined();
		const pullRequest = JSON.parse(
			await invoke<string>('forge_cli_cached', { cwd: '/x', tool: 'gh', args: ['pr', 'view', '230', '--json', 'title'] }),
		);
		expect(pullRequest).toMatchObject({ state: 'MERGED', headRefName: expect.any(String), baseRefName: 'dev_jerome' });
		await expect(
			invoke('forge_cli_cached', { cwd: '/x', tool: 'gh', args: ['issue', 'view', '123', '--json', 'title'] }),
		).rejects.toThrow();
	});

	it('answers the stored references with the rows of an issue and of a pull request, and with no row for the issue 123', async () => {
		TauriMock.install();
		expect(await invoke('chat_references_synchronize', { folder: '/x' })).toEqual({ repository: 'heidrun-org/heidrun', codeHostingError: null });
		const rows = await invoke<{ issues: { number: number; labelColors: Record<string, string> }[]; pullRequests: { headRefName: string }[] }>(
			'chat_references_find',
			{ repository: 'heidrun-org/heidrun', issues: [250, 123], pullRequests: [230] },
		);
		expect(rows.issues.map((issue) => issue.number)).toEqual([250]);
		expect(rows.issues[0].labelColors['Simple Work']).toBe('2ea043');
		expect(rows.pullRequests[0].headRefName).toEqual(expect.any(String));
	});

	it('answers the cached forge command with the list of the open issues and the list of the open pull requests', async () => {
		TauriMock.install();
		const issues = JSON.parse(
			await invoke<string>('forge_cli_cached', { cwd: '/x', tool: 'gh', args: ['issue', 'list', '--state', 'open', '--json', 'number,title,url'] }),
		);
		expect(issues.map((issue: { number: number }) => issue.number)).toEqual([370, 366, 351]);
		const pullRequests = JSON.parse(
			await invoke<string>('forge_cli_cached', { cwd: '/x', tool: 'gh', args: ['pr', 'list', '--state', 'open', '--json', 'number,title,url'] }),
		);
		expect(pullRequests).toEqual([
			expect.objectContaining({ number: 369, url: expect.stringContaining('/pull/369') }),
			expect.objectContaining({ number: 365, url: expect.stringContaining('/pull/365') }),
		]);
	});

	it('keeps, in the fake list of the cached forge command, the items that match the words author:, label:, and no:label of --search', async () => {
		TauriMock.install();
		const numbersFor = async (tool: 'issue' | 'pr', search: string): Promise<number[]> => {
			const args = [tool, 'list', '--state', 'open', '--search', search, '--json', 'number'];
			const items = JSON.parse(await invoke<string>('forge_cli_cached', { cwd: '/x', tool: 'gh', args }));
			return items.map((item: { number: number }) => item.number);
		};
		expect(await numbersFor('issue', 'author:@me')).toEqual([370, 351]);
		expect(await numbersFor('issue', 'author:erictang')).toEqual([366]);
		expect(await numbersFor('issue', '-author:erictang')).toEqual([370, 351]);
		expect(await numbersFor('issue', 'label:bug')).toEqual([351]);
		expect(await numbersFor('issue', 'label:"Simple Work" -label:bug')).toEqual([370]);
		expect(await numbersFor('issue', 'no:label')).toEqual([366]);
		expect(await numbersFor('issue', 'mentions:@me')).toEqual([370, 366, 351]);
		expect(await numbersFor('pr', 'author:erictang')).toEqual([365]);
		expect(await numbersFor('pr', 'label:bug')).toEqual([]);
	});

	it('keeps a translation table of the clustered dynamic topics, and answers a fake coding agent that groups by the first four letters', async () => {
		TauriMock.install();
		expect(await invoke('topic_clusters_read')).toEqual({});
		await invoke('topic_clusters_write', { rows: { sidebar: 'sidebar' } });
		expect(await invoke('topic_clusters_read')).toEqual({ sidebar: 'sidebar' });
		await invoke('topic_clusters_write', { rows: {} });
		const prompt = 'Existing clusters: []\nNew labels: ["sidebars","sidebar","cache"]';
		const answer = await invoke<{ agent: string; text: string }>('coding_agent_ask', { prompt });
		expect(answer.agent).toBe('codex');
		expect(JSON.parse(answer.text)).toEqual([
			{ topic: 'sidebars', cluster: 'sidebar' },
			{ topic: 'sidebar', cluster: 'sidebar' },
			{ topic: 'cache', cluster: 'cache' },
		]);
	});

	it('answers the prompt of the method Language model with a fake coding agent that takes the long words of each title', async () => {
		TauriMock.install();
		const conversations = [
			{ conversation: 1, title: 'Fix the Sidebar cache bug', firstMessages: [] },
			{ conversation: 2, title: 'Do it', firstMessages: [] },
		];
		const prompt = `Existing topics: []\nConversations: ${JSON.stringify(conversations)}`;
		const answer = await invoke<{ agent: string; text: string }>('coding_agent_ask', { prompt });
		expect(answer.agent).toBe('codex');
		expect(JSON.parse(answer.text)).toEqual([
			{ conversation: 1, topics: ['sidebar', 'cache'] },
			{ conversation: 2, topics: ['general'] },
		]);
	});

	it('keeps the configuration of the fake project that the Tauri command project_save writes, for the Tauri command project_load', async () => {
		TauriMock.install();
		const first = await invoke<{ root: string; config: unknown }>('project_load', { cwd: '/Users/demo/webwork/heidrun' });
		expect(first.root).toBe('/Users/demo/webwork/heidrun');
		expect(first.config).toEqual({ version: 1, launchers: [] });
		const config = { version: 1, launchers: [], guards: { disabled: ['guards.why.gitClean'] } };
		await invoke('project_save', { root: '/Users/demo/webwork/heidrun', config });
		const second = await invoke<{ config: unknown }>('project_load', { cwd: '/Users/demo/webwork/heidrun' });
		expect(second.config).toEqual(config);
		TauriMockFixture.setProjectConfig({ version: 1, launchers: [] });
	});

	it('keeps the user level launchers that the Tauri command launchers_user_write writes, for the Tauri command launchers_user_read', async () => {
		TauriMock.install();
		const first = await invoke<{ exists: boolean; launchers: unknown[]; error: string | null }>('launchers_user_read');
		expect(first).toEqual({ exists: true, launchers: [], error: null });
		const launchers = [{ id: 'a', label: 'A', command: 'ls' }];
		await invoke('launchers_user_write', { launchers });
		const second = await invoke<{ launchers: unknown[] }>('launchers_user_read');
		expect(second.launchers).toEqual(launchers);
		expect(await invoke('launcher_folder_exists', { root: '/Users/demo/webwork/heidrun', folder: 'web' })).toBe(true);
		TauriMockFixture.setUserLaunchers([]);
	});

	it('answers the root of the repository with the chats, and the commands that the files line of a chat calls', async () => {
		TauriMock.install();
		const result = await invoke<{ root: string }>('chats_list', { folder: '/Users/demo/webwork/heidrun', limit: 5 });
		expect(result.root).toBe('/Users/demo/webwork/heidrun');
		const refs = await invoke<{ remote: string }>('project_refs', { cwd: '/Users/demo/webwork/heidrun' });
		expect(refs.remote).toBe('git@github.com:heidrun-org/heidrun.git');
		const resolved = await invoke('files_resolve', {
			cwd: '/Users/demo/webwork/heidrun',
			path: '/Users/demo/webwork/heidrun/docs/a.md',
		});
		expect(resolved).toEqual({ root: '/Users/demo/webwork/heidrun', path: 'docs/a.md' });
		const existence = await invoke<{ path: string; on_disk: boolean; on_remote: boolean }[]>('chats_files_exist', {
			folder: '/Users/demo/webwork/heidrun',
			paths: ['docs/a.md', 'src/OldCard.vue', 'src/InformationCard.vue'],
		});
		expect(existence.map((item) => [item.on_disk, item.on_remote])).toEqual([
			[true, true],
			[false, false],
			[true, false],
		]);
		expect(
			await invoke('chats_worktrees_exist', {
				folders: ['/Users/demo/webwork/heidrun/.claude/worktrees/fix-35', '/Users/demo/webwork/heidrun/.claude/worktrees/removed-36'],
			}),
		).toEqual(['/Users/demo/webwork/heidrun/.claude/worktrees/fix-35']);
		expect(
			await invoke('chats_worktrees_branches', {
				folders: ['/Users/demo/webwork/heidrun/.claude/worktrees/fix-35', '/Users/demo/webwork/heidrun/.claude/worktrees/removed-36'],
			}),
		).toEqual([{ folder: '/Users/demo/webwork/heidrun/.claude/worktrees/fix-35', branch: 'fix-35' }]);
		expect(await invoke('chats_worktree_open_in_vscode', { folder: '/Users/demo/webwork/heidrun/.claude/worktrees/fix-35' })).toBeNull();
		expect(await invoke('file_open_external', { root: '/Users/demo/webwork/heidrun', path: 'docs/a.md' })).toBeNull();
	});

	it('answers the Mire commands with no observation and an unavailable shared Codex server, never with fictional data', async () => {
		TauriMock.install();
		const observations = await invoke<{ claude: { sessions: unknown[] }; codex: { coverage: string; threads: unknown[] } }>(
			'mire_subscribe',
			{ viewId: 'modal' },
		);
		expect(observations.claude.sessions).toEqual([]);
		expect(observations.codex.coverage).toBe('unavailable');
		expect(observations.codex.threads).toEqual([]);
		expect(await invoke('mire_unsubscribe', { viewId: 'modal' })).toBeNull();
		expect(await invoke('mire_claude_observer_mod_path')).toBeNull();
		expect(await invoke('codex_prepare_chat', { cwd: '/work', name: 'Tab', model: null })).toBeNull();
	});

	it('rejects a Tauri command that it does not list', async () => {
		TauriMock.install();
		await expect(invoke('pty_spawn')).rejects.toThrow('pty_spawn');
	});

	it('does nothing when a Tauri bridge already exists', () => {
		const existingBridge = {};
		tauriWindow.__TAURI_INTERNALS__ = existingBridge;
		TauriMock.install();
		expect(tauriWindow.__TAURI_INTERNALS__).toBe(existingBridge);
		expect(Object.keys(existingBridge).length).toBe(0);
	});
});

describe('TauriMockFixture', () => {
	it('links every pane to a tab and to a workspace that exist', () => {
		const snapshot = TauriMockFixture.buildSnapshot();
		const tabIdSet = new Set(snapshot.tabs.map((tabInfo) => tabInfo.tab_id));
		const workspaceIdSet = new Set(snapshot.workspaces.map((workspaceInfo) => workspaceInfo.workspace_id));
		for (const paneInfo of snapshot.panes) {
			expect(tabIdSet.has(paneInfo.tab_id)).toBe(true);
			expect(workspaceIdSet.has(paneInfo.workspace_id)).toBe(true);
		}
	});

	it('gives every tab a layout that lists only panes that exist', () => {
		const snapshot = TauriMockFixture.buildSnapshot();
		const paneIdSet = new Set(snapshot.panes.map((paneInfo) => paneInfo.pane_id));
		for (const tabInfo of snapshot.tabs) {
			const layout = snapshot.layouts.find((candidate) => candidate.tab_id === tabInfo.tab_id);
			expect(layout).not.toBeUndefined();
			for (const layoutPane of layout?.panes ?? []) {
				expect(paneIdSet.has(layoutPane.pane_id)).toBe(true);
			}
		}
	});

	it('shows every agent status once', () => {
		const snapshot = TauriMockFixture.buildSnapshot();
		const statusList = snapshot.panes.map((paneInfo) => paneInfo.agent_status).sort();
		expect(statusList).toEqual(['blocked', 'done', 'idle', 'working']);
	});
});

describe('TauriMock user activity', () => {
	afterEach(() => {
		clearMocks();
		delete tauriWindow.__TAURI_INTERNALS__;
	});

	it('answers the Tauri command user_activity_records_in_range with fake active periods of the last 30 days that end before the end of the range', async () => {
		TauriMock.install();
		const until = Date.now();
		const records = await invoke<{ workspaceFolder: string; startedAt: string; endedAt: string }[]>('user_activity_records_in_range', {
			since: new Date(until - 30 * 86_400_000).toISOString(),
			until: new Date(until).toISOString(),
		});
		expect(records.length).toBeGreaterThan(30);
		for (const record of records) {
			expect(Date.parse(record.startedAt)).toBeLessThan(Date.parse(record.endedAt));
			expect(Date.parse(record.endedAt)).toBeLessThanOrEqual(until);
			expect(Date.parse(record.startedAt)).toBeGreaterThanOrEqual(until - 30 * 86_400_000);
		}
		const startedAtList = records.map((record) => Date.parse(record.startedAt));
		expect(startedAtList).toEqual([...startedAtList].sort((first, second) => first - second));
	});

	it('gives the fake active periods to three workspace folders, so that the histogram has workspaces to choose', async () => {
		TauriMock.install();
		const until = Date.now();
		const records = await invoke<{ workspaceFolder: string }[]>('user_activity_records_in_range', {
			since: new Date(until - 30 * 86_400_000).toISOString(),
			until: new Date(until).toISOString(),
		});
		expect(new Set(records.map((record) => record.workspaceFolder)).size).toBe(3);
		expect(records.filter((record) => record.workspaceFolder === '/Users/demo/webwork/heidrun').length).toBeGreaterThan(
			records.filter((record) => record.workspaceFolder === '/Users/demo/webwork/website').length,
		);
	});
});

describe('TauriMock work of one person', () => {
	afterEach(() => {
		clearMocks();
		delete tauriWindow.__TAURI_INTERNALS__;
	});

	it('answers the Tauri command person_work_in_range with the fake work of two people in the last 30 days', async () => {
		TauriMock.install();
		const until = new Date(2026, 9, 15).getTime();
		const items = await invoke<PersonWorkItems>('person_work_in_range', {
			folder: '/Users/demo/webwork/heidrun',
			since: new Date(until - 30 * 86_400_000).toISOString(),
			until: new Date(until).toISOString(),
		});
		expect(items.repository).toBe('heidrun-org/heidrun');
		expect(items.codeHostingError).toBeNull();
		expect(new Set(items.commits.map((commit) => commit.authorName))).toEqual(new Set(['Jérôme Étienne', 'Eric']));
		expect(items.pullRequests.length).toBeGreaterThan(10);
		expect(items.issues.length).toBeGreaterThan(3);
		for (const time of [...items.commits.map((commit) => commit.committedAt), ...items.pullRequests.map((item) => item.createdAt)]) {
			expect(Date.parse(time)).toBeLessThan(until);
			expect(Date.parse(time)).toBeGreaterThanOrEqual(until - 30 * 86_400_000);
		}
	});

	it('answers the Tauri command ai_cost_in_range with no hour until the history is imported by ai_cost_synchronize', async () => {
		TauriMock.install();
		TauriMockFixture.resetAiCostImports();
		const until = new Date(2026, 9, 15).getTime();
		const parameters = {
			folders: ['/Users/demo/webwork/heidrun'],
			since: new Date(until - 30 * 86_400_000).toISOString(),
			until: new Date(until).toISOString(),
			timeZone: 'Europe/Paris',
		};
		const before = await invoke<AiCostAnswer>('ai_cost_in_range', parameters);
		expect(before.hours).toEqual([]);
		expect(before.workspaces[0].synchronizedAt).toBeNull();
		const notImported = await invoke<AiCostSynchronization>('ai_cost_synchronize', { folders: parameters.folders, isImportAllowed: false });
		expect(notImported.workspaces[0].synchronizedAt).toBeNull();
		const imported = await invoke<AiCostSynchronization>('ai_cost_synchronize', { folders: parameters.folders, isImportAllowed: true });
		expect(imported.workspaces[0].synchronizedAt).not.toBeNull();
		expect(imported.priceWarning).toBeNull();
		const answer = await invoke<AiCostAnswer>('ai_cost_in_range', parameters);
		expect(new Set(answer.hours.map((hour) => hour.codingAgent))).toEqual(new Set(['claude', 'codex']));
		expect(new Set(answer.hours.filter((hour) => hour.costUsd === null).map((hour) => hour.day)).size).toBe(1);
		expect(answer.hours.length).toBeGreaterThan(200);
		expect(answer.priceVersion).toBe(1);
		for (const hour of answer.hours) {
			expect(Date.parse(hour.startedAt)).toBeLessThan(until);
			expect(Date.parse(hour.startedAt)).toBeGreaterThanOrEqual(until - 31 * 86_400_000);
			expect(hour.unpricedTokens).toBe(hour.costUsd === null ? hour.tokens : 0);
			expect(new Date(hour.startedAt).getMinutes()).toBe(0);
		}
		const times = answer.hours.map((hour) => Date.parse(hour.startedAt));
		expect(times).toEqual([...times].sort((first, second) => first - second));
	});
});
