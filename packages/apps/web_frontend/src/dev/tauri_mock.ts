import type { InvokeArgs } from '@tauri-apps/api/core';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import type { ChatSortKey, ChatSortOrder } from '../stores/chats';
import { TauriMockFixture } from './tauri_mock_fixture';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TauriMock — answers the Tauri commands in a plain browser, for the development server only
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The payload of the Tauri command `herdr_request`. */
type HerdrRequestPayload = {
	/** The name of the Herdr request, for example `session.snapshot`. */
	method: string;
	/** The parameters of the Herdr request. */
	params: Record<string, unknown>;
};

/**
 * A minimal replacement for the Tauri bridge. It lets a plain browser show the connected screens of the
 * application, with the fake Herdr session of `TauriMockFixture`. Every command that is not listed here fails
 * with an error, the same way as a command that the Rust side refuses.
 */
export class TauriMock {
	/**
	 * Installs the mock when the code runs in the development server and no real Tauri bridge exists.
	 * Does nothing in a production build, and does nothing inside the Tauri window.
	 */
	static install(): void {
		if (import.meta.env.DEV === false) {
			return;
		}
		const tauriWindow = window as unknown as { __TAURI_INTERNALS__?: unknown };
		if (tauriWindow.__TAURI_INTERNALS__ !== undefined) {
			return;
		}
		mockWindows('main');
		mockIPC(TauriMock._handleCommand, {
			shouldMockEvents: true,
		});
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Command handlers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Answers one Tauri command.
	 *
	 * @param command - The name of the Tauri command.
	 * @param payload - The arguments of the Tauri command.
	 * @returns The value that the command returns.
	 */
	private static _handleCommand(command: string, payload?: InvokeArgs): unknown {
		if (command.startsWith('plugin:')) {
			return null;
		}
		switch (command) {
			case 'herdr_request':
				return TauriMock._handleHerdrRequest(payload as HerdrRequestPayload);
			case 'herdr_paths':
				return {
					socket: '/tmp/herdr.sock',
					socket_exists: true,
					bin: '/usr/local/bin/herdr',
					bin_exists: true,
				};
			case 'codex_usage':
				return {
					available: false,
					sessions: {},
				};
			case 'history_read':
				return [];
			case 'chats_synchronize':
				return { root: (payload as { folder: string }).folder, chat_session_count: 0 };
			case 'chats_list':
				return TauriMockFixture.buildChats(
					(payload as { limit: number }).limit,
					(payload as { sortKey?: ChatSortKey }).sortKey,
					(payload as { order?: ChatSortOrder }).order,
				);
			case 'user_activity_synchronize':
				return { recordCount: 0 };
			case 'user_activity_records_in_range':
				return TauriMockFixture.buildUserActivityRecords(Date.parse((payload as { until: string }).until));
			case 'person_work_synchronize':
				return { repository: 'heidrun-org/heidrun', codeHostingError: null };
			case 'person_work_in_range':
				return TauriMockFixture.buildPersonWorkItems(Date.parse((payload as { until: string }).until));
			case 'ai_cost_synchronize':
				return TauriMockFixture.buildAiCostSynchronization(
					(payload as { folders: string[] }).folders,
					(payload as { isImportAllowed: boolean }).isImportAllowed,
				);
			case 'ai_cost_in_range':
				return TauriMockFixture.buildAiCostAnswer(
					(payload as { folders: string[] }).folders,
					Date.parse((payload as { until: string }).until),
				);
			case 'project_refs':
				return {
					root: '/Users/demo/webwork/heidrun',
					remote: 'git@github.com:heidrun-org/heidrun.git',
					references: null,
				};
			case 'project_load':
				return TauriMockFixture.buildProject((payload as { cwd: string }).cwd);
			case 'project_save':
				TauriMockFixture.setProjectConfig((payload as { config: unknown }).config);
				return null;
			case 'launchers_user_read':
				return TauriMockFixture.buildUserLaunchersFile();
			case 'launchers_user_write':
				TauriMockFixture.setUserLaunchers((payload as { launchers: unknown[] }).launchers);
				return null;
			case 'launcher_folder_exists':
				return true;
			case 'chat_images_find':
				return {
					keys: [],
					images: [],
				};
			case 'chat_references_synchronize':
				return { repository: 'heidrun-org/heidrun', codeHostingError: null };
			case 'chat_references_find':
				return TauriMockFixture.buildStoredReferences(
					(payload as { issues: number[] }).issues,
					(payload as { pullRequests: number[] }).pullRequests,
				);
			case 'forge_cli_cached': {
				const args = (payload as { args: string[] }).args;
				return args[1] === 'list' ? TauriMockFixture.buildForgeListAnswer(args) : TauriMockFixture.buildForgeAnswer(args);
			}
			case 'forge_cli_cached_with_source': {
				const args = (payload as { args: string[] }).args;
				const output = args[1] === 'list' ? TauriMockFixture.buildForgeListAnswer(args) : TauriMockFixture.buildForgeAnswer(args);
				return {
					output,
					failure: null,
					keptAt: null,
				};
			}
			case 'topic_clusters_read':
				return TauriMockFixture.getTopicClusterRows();
			case 'topic_clusters_write':
				TauriMockFixture.setTopicClusterRows((payload as { rows: Record<string, string> }).rows);
				return null;
			case 'coding_agent_ask':
				return TauriMockFixture.buildCodingAgentAnswer((payload as { prompt: string }).prompt);
			case 'chats_files_exist':
				return (payload as { paths: string[] }).paths.map((path) => ({
					path,
					on_disk: path.includes('OldCard') === false,
					on_remote: path.includes('OldCard') === false && path.includes('InformationCard') === false,
				}));
			case 'chats_worktrees_exist':
				return (payload as { folders: string[] }).folders.filter((folder) => folder.includes('removed') === false);
			case 'chats_worktrees_branches':
				return (payload as { folders: string[] }).folders
					.filter((folder) => folder.includes('removed') === false)
					.map((folder) => ({ folder, branch: folder.split('/').filter(Boolean).pop() ?? null }));
			case 'chats_worktree_open_in_vscode':
				return null;
			case 'files_resolve':
				return {
					root: '/Users/demo/webwork/heidrun',
					path: (payload as { path: string }).path.replace('/Users/demo/webwork/heidrun/', ''),
				};
			case 'git_status':
				return TauriMockFixture.buildGitStatus();
			case 'file_open_external':
			case 'mobile_status':
			case 'herdr_watch_panes':
			case 'show_main_window':
			case 'history_append':
			case 'application_log_load_time':
				return null;
			default:
				throw new Error(`mock: the command "${command}" is not available in the browser`);
		}
	}

	/**
	 * Answers one Herdr request.
	 *
	 * @param requestPayload - The method and the parameters of the Herdr request.
	 * @returns The result of the Herdr request.
	 */
	private static _handleHerdrRequest(requestPayload: HerdrRequestPayload): unknown {
		switch (requestPayload.method) {
			case 'session.snapshot':
				return {
					snapshot: TauriMockFixture.buildSnapshot(),
				};
			case 'layout.set_split_ratio':
				TauriMockFixture.setSplitRatio(
					requestPayload.params.path as boolean[],
					requestPayload.params.ratio as number,
				);
				return {};
			case 'pane.read':
				return {
					read: {
						text: TauriMockFixture.readPaneText(String(requestPayload.params.pane_id)),
					},
				};
			default:
				return {};
		}
	}
}
