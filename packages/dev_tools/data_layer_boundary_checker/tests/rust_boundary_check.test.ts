import { describe, expect, it } from 'vitest';
import type { BoundaryViolation } from '../src/boundary_types.ts';
import { RustBoundaryCheck } from '../src/rust_boundary_check.ts';

/**
 * Gives the identifiers of the rules that the violations break.
 * @param violations - The violations.
 * @returns The identifiers, in the order of the violations.
 */
function ruleIds(violations: BoundaryViolation[]): string[] {
	return violations.map((violation) => violation.ruleId);
}

const SCOPE_FILE = 'packages/apps/desktop_tauri/src/past_chats/example.rs';

describe('RustBoundaryCheck.checkScopeFile', () => {
	it('accepts a command that calls the functions refresh_* and find_* of a package', () => {
		const code = [
			'use data_layer_coding_agents::{find_chat_list, refresh_chat_sessions, ChatList};',
			'use data_layer_source_control::default_database_path;',
			'',
			'pub fn chats_list(folder: String) -> Result<ChatList, String> {',
			'    let root = crate::project::find_root(Path::new(&folder));',
			'    let _guard = heidrun_data::lock_database(&default_database_path())?;',
			'    refresh_chat_sessions(&default_database_path(), &root)?;',
			'    find_chat_list(&default_database_path(), &root)',
			'}',
		].join('\n');
		expect(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, code)).toEqual([]);
	});

	it('reports the program that a command starts', () => {
		const code = 'fn f() { let out = std::process::Command::new("git").output(); }';
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, code))).toContain('process-spawn');
	});

	it('reports an SQLite library and the database type of a package', () => {
		const code = [
			'use rusqlite::Connection;',
			'use data_layer_source_control::SourceControlDatabase;',
			'fn f() { let c = Connection::open("x.sqlite"); }',
		].join('\n');
		const ids = ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, code));
		expect(ids).toContain('sql-library');
		expect(ids).toContain('database-type');
	});

	it('reports the text of an SQL statement in a string', () => {
		const selectCode = 'fn f() { let sql = "select author_name from commits where 1"; }';
		const deleteCode = 'fn f() { let sql = "DELETE FROM chats"; }';
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, selectCode))).toEqual(['sql-text']);
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, deleteCode))).toEqual(['sql-text']);
	});

	it('reports a file that a command reads, and a path attribute that loads a module from outside', () => {
		const readCode = 'fn f() { let text = std::fs::read_to_string("chat.jsonl"); }';
		const openCode = 'use std::fs::File;\nfn f() { let file = File::open("chat.jsonl"); }';
		const moduleCode = '#[path = "../elsewhere.rs"]\nmod elsewhere;';
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, readCode))).toContain('file-access');
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, openCode))).toContain('file-access');
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, moduleCode))).toContain('file-access');
	});

	it('reports a network request and a web address', () => {
		const code = 'fn f() { let answer = reqwest::blocking::get("https://api.github.com/repos"); }';
		const ids = ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, code));
		expect(ids).toContain('network');
		expect(ids.filter((id) => id === 'network')).toHaveLength(2);
	});

	it('reports the collection code of a package: a reader, a runner, or a function that does not start with refresh_ or find_', () => {
		const typeCode = 'use data_layer_source_control::GitCommandRunner;\nfn f() { let r = GitCommandRunner::new(); }';
		const functionCode = 'use data_layer_coding_agents::read_chat_session_files;';
		const groupCode = 'use data_layer_coding_agents::{find_chat_list, read_token_usage};';
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, typeCode))).toContain('collection-type');
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, functionCode))).toEqual(['package-function']);
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, groupCode))).toEqual(['package-function']);
	});

	it('reports a glob and a new name of a package, which the check cannot read', () => {
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, 'use data_layer_coding_agents::*;'))).toEqual([
			'package-glob',
		]);
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, 'use data_layer_coding_agents as agents;'))).toEqual([
			'package-alias',
		]);
	});

	it('reports a helper of the desktop application that is not in the list, and allows the ones of the list', () => {
		const allowedCode = [
			'use crate::app_data::user_activity_file_path;',
			'fn f() { crate::project::find_root(p); crate::statistics::ai_cost::roots_of(f); }',
		].join('\n');
		expect(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, allowedCode)).toEqual([]);
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, 'use crate::git::read_log;'))).toEqual(['crate-helper']);
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, 'use crate::{app_data::x, git::y};'))).toEqual([
			'crate-helper',
		]);
		expect(ruleIds(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, 'use crate::*;'))).toEqual(['crate-helper']);
	});

	it('does not report a comment, a string that is not SQL, or the code of the tests', () => {
		const code = [
			'//! Never runs `Command::new("git")` or `rusqlite`.',
			'/// See https://example.com and SELECT * FROM commits.',
			'fn f() { let name = "chats_list"; }',
			'#[cfg(test)]',
			'mod tests {',
			'    use std::process::Command;',
			'    use rusqlite::Connection;',
			'    fn t() { std::fs::read_to_string("x"); let s = "SELECT 1"; }',
			'}',
		].join('\n');
		expect(RustBoundaryCheck.checkScopeFile(SCOPE_FILE, code)).toEqual([]);
	});

	it('gives the line number, the rule, and the text of the line', () => {
		const code = 'fn a() {}\n\n    let out = Command::new("git");\n';
		const violations = RustBoundaryCheck.checkScopeFile(SCOPE_FILE, code);
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatchObject({
			filePath: SCOPE_FILE,
			lineNumber: 3,
			ruleId: 'process-spawn',
			excerpt: 'let out = Command::new("git");',
		});
	});
});

describe('RustBoundaryCheck.checkOutsideFile', () => {
	const outsideFile = 'packages/apps/desktop_tauri/src/example.rs';

	it('allows the two functions that give a folder name', () => {
		const code = 'fn f() { data_layer_coding_agents::claude_dir(); data_layer_coding_agents::codex_home(); }';
		expect(RustBoundaryCheck.checkOutsideFile(outsideFile, code)).toEqual([]);
	});

	it('reports any other use of a package of the data layer', () => {
		const code = 'use data_layer_coding_agents::find_chat_list;\nfn f() { heidrun_data::lock_database(p); }';
		expect(ruleIds(RustBoundaryCheck.checkOutsideFile(outsideFile, code))).toEqual([
			'package-outside-scope',
			'package-outside-scope',
		]);
	});

	it('reports a function with the name of a command of the scope, except in the file of the actions', () => {
		const code = 'pub fn chats_extra() {}\npub fn person_work_extra() {}\npub fn user_activity_append() {}';
		expect(ruleIds(RustBoundaryCheck.checkOutsideFile(outsideFile, code))).toEqual([
			'command-outside-scope',
			'command-outside-scope',
		]);
		const actionFile = 'packages/apps/desktop_tauri/src/worktree_actions.rs';
		expect(RustBoundaryCheck.checkOutsideFile(actionFile, 'pub fn chats_worktree_open_in_vscode() {}')).toEqual([]);
	});
});

describe('RustBoundaryCheck.checkManifest', () => {
	it('reports an SQLite library in the dependencies', () => {
		const manifest = ['[dependencies]', 'serde = "1"', 'rusqlite = { version = "0.31", features = ["bundled"] }'].join('\n');
		const violations = RustBoundaryCheck.checkManifest('Cargo.toml', manifest);
		expect(ruleIds(violations)).toEqual(['manifest-sql-library']);
		expect(violations[0]?.lineNumber).toBe(3);
	});

	it('accepts the manifest with no SQLite library', () => {
		expect(RustBoundaryCheck.checkManifest('Cargo.toml', '[dependencies]\nserde = "1"\n')).toEqual([]);
	});
});
