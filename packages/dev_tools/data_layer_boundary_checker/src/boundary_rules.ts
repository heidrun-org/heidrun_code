import type { FrontendPatternRule, PatternRule } from './boundary_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Where the boundary applies
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The folder of the source of the desktop application, relative to the root of the repository. */
export const DESKTOP_SOURCE_FOLDER = 'packages/apps/desktop_tauri/src';

/** The folders of the desktop application where the commands of the Past chats sidebar section and of the Statistics window are. */
export const RUST_SCOPE_FOLDERS = [`${DESKTOP_SOURCE_FOLDER}/past_chats`, `${DESKTOP_SOURCE_FOLDER}/statistics`];

/** The files of the desktop application that the commands of the scope use as a helper, and that follow the same rules. */
export const RUST_SCOPE_FILES = [`${DESKTOP_SOURCE_FOLDER}/app_data.rs`];

/** The folder of the source of the web page, relative to the root of the repository. */
export const FRONTEND_SOURCE_FOLDER = 'packages/apps/web_frontend/src';

/**
 * The files of the web page that belong to the Past chats sidebar section or to the Statistics window, as patterns on the path
 * relative to the folder of the web frontend source. A file of the tests is never in the scope.
 */
export const FRONTEND_SCOPE_PATTERNS = [
	/^stores\/(chats|chat_references|chat_open|dynamic_topics|language_model_topics|topic_clusters)\.ts$/,
	/^components\/(Chat[A-Za-z]*|DynamicTopicBar|PersonWorkTab|StatisticsModal|UserActivityTab|UserActivityHistogram)\.vue$/,
	/^lib\/(chat_[a-z_]+|dynamic_topic[a-z_]*|topic_clusters|ai_cost|person_work|slot_text|calendar_slots)\.ts$/,
	/^lib\/user_activity_(slots|slot_length_text|view|workspaces)\.ts$/,
];

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Rules for the Rust files of the scope
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The patterns that no Rust file of the scope may hold outside its test code. */
export const RUST_CODE_RULES: PatternRule[] = [
	{
		ruleId: 'process-spawn',
		pattern: /\bCommand\s*::\s*new\b|\bstd\s*::\s*process\b|\btokio\s*::\s*process\b|\bprocess\s*::\s*Command\b/,
		message: 'A command of the scope starts a program. Only a package of the data layer may run git, gh, or glab.',
	},
	{
		ruleId: 'sql-library',
		pattern: /\brusqlite\b|\bsqlx\b|\bdiesel\b|\bConnection\s*::\s*open\w*\b/,
		message: 'A command of the scope uses an SQLite library. Only a package of the data layer may open the SQLite file.',
	},
	{
		ruleId: 'database-type',
		pattern:
			/\b(SourceControlDatabase|CodeHostingDatabase|UserActivityDatabase|ChatSessionsDatabase|TokenUsageDatabase|ModelPriceDatabase|ConfigurationDatabase)\b/,
		message: 'A command of the scope names the database type of a package. Call a function find_* or refresh_* of the package.',
	},
	{
		ruleId: 'collection-type',
		pattern:
			/\b(GitReader|GitRunner|GitCommandRunner|GithubReader|GraphqlRunner|GhGraphqlRunner|UserActivityFileReader|UserActivityFileReading|ScanCache|TokenUsageFiles|ConfigurationFolders|HeidrunDatabase)\b/,
		message: 'A command of the scope names the collection code of a package. Call the function refresh_* of the package.',
	},
	{
		ruleId: 'file-access',
		pattern:
			/\bstd\s*::\s*fs\b|\btokio\s*::\s*fs\b|\bfs\s*::\s*\w+|\bFile\s*::\s*(open|create)\b|\bOpenOptions\b|\bread_to_string\b|\bread_dir\b|\bwalkdir\b|\binclude(_str|_bytes)?\s*!|#\s*\[\s*path\b/,
		message: 'A command of the scope reads or writes a file. Only a package of the data layer may read a conversation file or another source.',
	},
	{
		ruleId: 'network',
		pattern: /\breqwest\b|\bureq\b|\bhyper\b|\bisahc\b|\bsurf\b|\bTcpStream\b|\bUnixStream\b|\bTcpListener\b|\bUdpSocket\b/,
		message: 'A command of the scope makes a network request. Only a package of the data layer may reach a service.',
	},
	{
		ruleId: 'module-escape',
		pattern: /\bsuper\s*::\s*super\b/,
		message: 'A file of the scope reaches a module outside the scope with super::super.',
	},
];

/** The patterns that no string literal of a Rust file of the scope may hold outside its test code. */
export const RUST_STRING_RULES: PatternRule[] = [
	{
		ruleId: 'sql-text',
		pattern:
			/\b(SELECT|INSERT\s+INTO|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW)|PRAGMA|ATTACH\s+DATABASE)\b|\bUPDATE\s+\w+\s+SET\b|\bselect\s+[\w*,\s.()'"]+?\s+from\s+\w+/i,
		message: 'A command of the scope holds the text of an SQL statement. Only a package of the data layer may run SQL.',
	},
	{
		ruleId: 'network',
		pattern: /https?:\/\//i,
		message: 'A command of the scope holds a web address. Only a package of the data layer may reach a service.',
	},
];

/**
 * The names that a Rust file of the scope may use from the desktop application itself, as paths after `crate::`. A path that ends
 * with `::` allows everything below it. A module of the desktop application that is not in this list is a helper that is not
 * checked, so the scope may not use it.
 */
export const ALLOWED_CRATE_PATHS = [
	'app_data::',
	'past_chats::',
	'statistics::',
	'project::find_root',
];

/**
 * The functions of a package of the data layer that a Rust file of the scope may call, besides the functions that start with
 * `refresh_` or `find_`.
 */
export const ALLOWED_PACKAGE_FUNCTIONS = ['default_database_path', 'local_time_zone_name', 'lock_database'];

/** The functions that a Rust file outside the scope may take from a package of the data layer: they give a folder name, never data. */
export const PATH_HELPERS_OUTSIDE_SCOPE = ['claude_dir', 'codex_home'];

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Rules for the web page files of the scope
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The Tauri commands that a web page file of the scope may call, each with the reason. A command that is not here is a way to
 * reach a source without a package of the data layer. The list is the only place where the commands are named.
 */
export const ALLOWED_FRONTEND_COMMANDS: Record<string, string> = {
	chats_synchronize: 'copies the chat session files into the SQLite file, with the package data_layer_coding_agents',
	chats_list: 'reads the stored chats',
	chats_files_exist: 'status of the files that a chat wrote, computed by the package data_layer_source_control',
	chats_worktrees_exist: 'status of the worktree folders that a chat names, computed by the package data_layer_source_control',
	chats_worktrees_branches: 'branch of each worktree, computed by the package data_layer_source_control',
	chats_worktree_open_in_vscode: 'an action: it opens a folder in VS Code and shows no data',
	chat_references_synchronize: 'copies the issues and pull requests of the GitHub repository, with the package data_layer_code_hosting',
	chat_references_find: 'reads the stored issues and pull requests',
	person_work_synchronize: 'copies the commits, pull requests, and issues, with two packages of the data layer',
	person_work_in_range: 'reads the stored commits, pull requests, and issues',
	ai_cost_synchronize: 'copies the tokens of the chat session files and refreshes the prices, with the package data_layer_coding_agents',
	ai_cost_in_range: 'reads the stored tokens and costs',
	user_activity_synchronize: 'copies the records of the activity of the user, with the package data_layer_user_activity',
	user_activity_records_in_range: 'reads the stored records of the activity of the user',
	topic_clusters_read: 'application state: it reads the translation table of the clustered dynamic topics, a file that Heidrun Code writes itself',
	topic_clusters_write: 'application state: it saves the translation table of the clustered dynamic topics, a file that Heidrun Code writes itself',
	coding_agent_ask: 'an action: it asks a coding agent to name topics, and it reads no source',
	files_resolve: 'an action: it turns a path of a chat into a file that can be opened',
	file_open_external: 'an action: it opens a file in another application',
};

/** The patterns that no web page file of the scope may hold, each with the files where the pattern is allowed. */
export const FRONTEND_CODE_RULES: FrontendPatternRule[] = [
	{
		ruleId: 'frontend-network',
		pattern: /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b/,
		message: 'A web page file of the scope makes a network request. The data comes from a Tauri command of a package of the data layer.',
		allowedFiles: {},
	},
	{
		ruleId: 'frontend-program',
		pattern: /plugin-shell|plugin-fs|\bCommand\.create\b|\breadTextFile\b/,
		message: 'A web page file of the scope starts a program or reads a file. The data comes from a Tauri command of a package of the data layer.',
		allowedFiles: {},
	},
	{
		ruleId: 'frontend-raw-tauri',
		pattern: /__TAURI/,
		message: 'A web page file of the scope calls the raw Tauri interface. The check reads only the direct calls of invoke.',
		allowedFiles: {},
	},
	{
		ruleId: 'frontend-live-forge',
		pattern: /forge_reference_details/,
		message: 'A web page file of the scope reads the forge live. The data comes from the stored rows of the package data_layer_code_hosting.',
		allowedFiles: {
			'stores/chat_references.ts': 'GitLab: the package data_layer_code_hosting reads GitHub only (issue 455)',
		},
	},
	{
		ruleId: 'frontend-repository-address',
		pattern: /\brefContext\b/,
		message: 'A web page file of the scope asks the desktop application for the remote of the repository, which runs git.',
		allowedFiles: {
			'components/ChatsPanel.vue': 'the forge and the address of the repository come from the project configuration and the remote origin; they choose GitHub or GitLab and build web links, and they are not data of a chat',
		},
	},
];

/**
 * The Rust files outside the scope that may define a Tauri command with the name of a command of the scope, each with the
 * reason. A command that reads or copies data for the Past chats sidebar section or the Statistics window is defined in a
 * scope folder, where the checks run.
 */
export const ALLOWED_COMMAND_FILES_OUTSIDE_SCOPE: Record<string, string> = {
	[`${DESKTOP_SOURCE_FOLDER}/worktree_actions.rs`]: 'an action: it opens a worktree folder in VS Code and shows no data',
};

/** The beginning of the name of a Tauri command that reads or copies data for the Past chats sidebar section or the Statistics window. */
export const SCOPE_COMMAND_NAME_PATTERN =
	/\bfn\s+((?:chats_|chat_references_|person_work_|ai_cost_|user_activity_synchronize|user_activity_records)\w*)/g;

/** The libraries that the manifest of the desktop application may not depend on: only a package of the data layer opens SQLite. */
export const FORBIDDEN_DESKTOP_DEPENDENCIES = ['rusqlite', 'sqlx', 'diesel'];
