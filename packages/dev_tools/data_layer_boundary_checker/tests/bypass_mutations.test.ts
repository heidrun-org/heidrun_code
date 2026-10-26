import Path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FRONTEND_CODE_RULES, RUST_CODE_RULES, RUST_STRING_RULES } from '../src/boundary_rules.ts';
import { DataLayerBoundaryChecker } from '../src/data_layer_boundary_checker.ts';
import { RepositoryCopy } from './repository_copy.ts';
import { TemporaryFolder } from './temporary_folder.ts';

const __dirname = import.meta.dirname;

const repositoryPath = Path.resolve(__dirname, '..', '..', '..', '..');
const desktop = 'packages/apps/desktop_tauri/src';
const frontend = 'packages/apps/web_frontend/src';

/**
 * A bypass that a developer could add: the text goes at the end of a file, and the checker must then report the rule.
 */
type Bypass = {
	/** What the bypass does, in a sentence for the name of the test. */
	name: string;
	/** The file that gets the text, relative to the root of the repository. The file is created when it does not exist. */
	filePath: string;
	/** The text to add at the end of the file. */
	addedText: string;
	/** The identifier of the rule that must report the bypass. */
	ruleId: string;
};

const BYPASSES: Bypass[] = [
	{
		name: 'a command of the Statistics window starts git',
		filePath: `${desktop}/statistics/person_work.rs`,
		addedText: 'fn bypass() { let _ = std::process::Command::new("git").arg("log").output(); }',
		ruleId: 'process-spawn',
	},
	{
		name: 'a command of the Past chats sidebar section uses an SQLite library',
		filePath: `${desktop}/past_chats/chats.rs`,
		addedText: 'use rusqlite::Connection;',
		ruleId: 'sql-library',
	},
	{
		name: 'a command names the database type of a package',
		filePath: `${desktop}/past_chats/chats_files.rs`,
		addedText: 'use data_layer_source_control::SourceControlDatabase;',
		ruleId: 'database-type',
	},
	{
		name: 'a command names the Git reader of a package',
		filePath: `${desktop}/statistics/person_work.rs`,
		addedText: 'use data_layer_source_control::GitCommandRunner;',
		ruleId: 'collection-type',
	},
	{
		name: 'a command reads a chat session file',
		filePath: `${desktop}/statistics/ai_cost.rs`,
		addedText: 'fn bypass() { let _ = std::fs::read_to_string("/home/a/.claude/projects/chat.jsonl"); }',
		ruleId: 'file-access',
	},
	{
		name: 'the command of the images of a chat reads a chat session file itself',
		filePath: `${desktop}/chat_images/chat_images.rs`,
		addedText: 'fn bypass() { let _ = std::fs::read_to_string("/home/a/.claude/projects/chat.jsonl"); }',
		ruleId: 'file-access',
	},
	{
		name: 'a command makes a network request',
		filePath: `${desktop}/past_chats/chat_references.rs`,
		addedText: 'fn bypass() { let _ = reqwest::blocking::get("https://api.github.com/repos/a/b/issues"); }',
		ruleId: 'network',
	},
	{
		name: 'a command holds the text of an SQL statement',
		filePath: `${desktop}/statistics/user_activity_records.rs`,
		addedText: 'fn bypass() { let _sql = "SELECT * FROM user_activity_records"; }',
		ruleId: 'sql-text',
	},
	{
		name: 'a file of the scope reaches a module outside the scope with super::super',
		filePath: `${desktop}/statistics/ai_cost.rs`,
		addedText: 'use super::super::git;',
		ruleId: 'module-escape',
	},
	{
		name: 'a command calls a collection function of a package',
		filePath: `${desktop}/past_chats/chats.rs`,
		addedText: 'use data_layer_coding_agents::read_chat_session_files;',
		ruleId: 'package-function',
	},
	{
		name: 'a command imports everything of a package',
		filePath: `${desktop}/statistics/user_activity_records.rs`,
		addedText: 'use data_layer_user_activity::*;',
		ruleId: 'package-glob',
	},
	{
		name: 'a command gives a new name to a package',
		filePath: `${desktop}/statistics/person_work.rs`,
		addedText: 'use data_layer_code_hosting as hosting;',
		ruleId: 'package-alias',
	},
	{
		name: 'a command uses a helper of the desktop application that no check reads',
		filePath: `${desktop}/past_chats/chats.rs`,
		addedText: 'use crate::git::read_log;',
		ruleId: 'crate-helper',
	},
	{
		name: 'a new file outside the scope takes data from a package of the data layer',
		filePath: `${desktop}/chat_cache.rs`,
		addedText: 'use data_layer_coding_agents::find_chat_list;',
		ruleId: 'package-outside-scope',
	},
	{
		name: 'a new file outside the scope defines a command of the Past chats sidebar section',
		filePath: `${desktop}/chats_extra.rs`,
		addedText: '#[tauri::command]\npub fn chats_extra() {}',
		ruleId: 'command-outside-scope',
	},
	{
		name: 'the desktop application depends on an SQLite library',
		filePath: 'packages/apps/desktop_tauri/Cargo.toml',
		addedText: 'rusqlite = { version = "0.31", features = ["bundled"] }',
		ruleId: 'manifest-sql-library',
	},
	{
		name: 'the web page of the Past chats sidebar section makes a network request',
		filePath: `${frontend}/stores/chat_references.ts`,
		addedText: 'export async function leak() { return fetch("https://api.github.com/repos/a/b/issues"); }',
		ruleId: 'frontend-network',
	},
	{
		name: 'the web page of the Past chats sidebar section calls a Tauri command that is not in the list',
		filePath: `${frontend}/stores/chats.ts`,
		addedText: 'export async function leak() { return invoke<string>("git_log", { cwd: "." }); }',
		ruleId: 'frontend-command',
	},
	{
		name: 'the web page calls invoke with a name that the check cannot read',
		filePath: `${frontend}/stores/chats.ts`,
		addedText: 'export async function leak(name: string) { return invoke(name); }',
		ruleId: 'frontend-dynamic-command',
	},
	{
		name: 'a Vue file of the Statistics window gives a new name to invoke',
		filePath: `${frontend}/components/PersonWorkTab.vue`,
		addedText: '<script lang="ts">\nconst call = invoke;\n</script>',
		ruleId: 'frontend-invoke-alias',
	},
	{
		name: 'the web page starts a program through the shell plugin',
		filePath: `${frontend}/stores/chats.ts`,
		addedText: 'import { Command } from "@tauri-apps/plugin-shell";',
		ruleId: 'frontend-program',
	},
	{
		name: 'the web page calls the raw Tauri interface',
		filePath: `${frontend}/lib/person_work.ts`,
		addedText: 'export const leak = () => (window as any).__TAURI_INTERNALS__.invoke("git_log");',
		ruleId: 'frontend-raw-tauri',
	},
	{
		name: 'the web page reads the forge live from a store other than the store of the references',
		filePath: `${frontend}/stores/chats.ts`,
		addedText: 'import { loadForgeReferenceDetails } from "./forge_reference_details";',
		ruleId: 'frontend-live-forge',
	},
	{
		name: 'a component of the Statistics window asks the desktop application for the remote of the repository',
		filePath: `${frontend}/components/PersonWorkTab.vue`,
		addedText: '<script lang="ts">\nconst context = await refContext(".");\n</script>',
		ruleId: 'frontend-repository-address',
	},
];

describe('a bypass of the data layer', () => {
	let copy: RepositoryCopy;

	beforeAll(() => {
		copy = new RepositoryCopy(repositoryPath);
	});

	afterEach(() => {
		copy.restore();
	});

	afterAll(() => {
		TemporaryFolder.removeAll();
	});

	it('is not in the copy of the real files that the other tests change', () => {
		const violations = DataLayerBoundaryChecker.check(copy.copyPath);
		expect(DataLayerBoundaryChecker.describe(violations)).toBe('');
	});

	for (const bypass of BYPASSES) {
		it(`makes the checker fail when ${bypass.name}`, () => {
			copy.append(bypass.filePath, bypass.addedText);
			const violations = DataLayerBoundaryChecker.check(copy.copyPath);
			const found = violations.filter((violation) => violation.ruleId === bypass.ruleId);
			expect(found.length, DataLayerBoundaryChecker.describe(violations)).toBeGreaterThan(0);
			expect(found[0]?.filePath).toBe(bypass.filePath);
		});
	}

	it('has a test for every rule of the checker', () => {
		const ruleIdsOfRules = [...RUST_CODE_RULES, ...RUST_STRING_RULES, ...FRONTEND_CODE_RULES].map((rule) => rule.ruleId);
		const ruleIdsOfCode = [
			'package-function',
			'package-glob',
			'package-alias',
			'crate-helper',
			'package-outside-scope',
			'command-outside-scope',
			'manifest-sql-library',
			'frontend-command',
			'frontend-dynamic-command',
			'frontend-invoke-alias',
		];
		const proven = new Set(BYPASSES.map((bypass) => bypass.ruleId));
		for (const ruleId of [...ruleIdsOfRules, ...ruleIdsOfCode]) {
			expect(proven.has(ruleId), `no bypass test for the rule ${ruleId}`).toBe(true);
		}
	});

	it('makes the checker fail when the bypass hides in a helper function that a command calls', () => {
		copy.append(`${desktop}/helper_for_chats.rs`, 'pub fn read_chats() { let _ = std::fs::read_to_string("chat.jsonl"); }');
		copy.append(`${desktop}/past_chats/chats.rs`, 'fn bypass() { crate::helper_for_chats::read_chats(); }');
		const ruleIds = DataLayerBoundaryChecker.check(copy.copyPath).map((violation) => violation.ruleId);
		expect(ruleIds).toContain('crate-helper');
	});

	it('is not reported when it is in code that only the tests compile', () => {
		copy.append(
			`${desktop}/past_chats/chats.rs`,
			'#[cfg(test)]\nmod bypass_in_tests {\n    fn t() { let _ = std::process::Command::new("git"); let _ = std::fs::read_to_string("x"); }\n}',
		);
		expect(DataLayerBoundaryChecker.check(copy.copyPath)).toEqual([]);
	});

	it('is not reported in a file of the web page that is outside the Past chats sidebar section and the Statistics window', () => {
		copy.append(`${frontend}/stores/git.ts`, 'export async function other() { return fetch("https://example.com"); }');
		expect(DataLayerBoundaryChecker.check(copy.copyPath)).toEqual([]);
	});
});
