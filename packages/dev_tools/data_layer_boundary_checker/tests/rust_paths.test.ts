import { describe, expect, it } from 'vitest';
import { RustPaths } from '../src/rust_paths.ts';

/**
 * Gives the texts of the paths that the reader finds.
 * @param code - The Rust code to read.
 * @returns The texts of the paths.
 */
function pathTexts(code: string): string[] {
	return RustPaths.find(code).map((rustPath) => rustPath.text);
}

describe('RustPaths.find', () => {
	it('reads the path of a call', () => {
		expect(pathTexts('let root = crate::project::find_root(folder);')).toEqual(['crate::project::find_root']);
	});

	it('reads each name of a group', () => {
		expect(pathTexts('use data_layer_source_control::{find_commits, Commit};')).toEqual([
			'data_layer_source_control::find_commits',
			'data_layer_source_control::Commit',
		]);
	});

	it('reads a group that is nested and cut over several lines', () => {
		const code = ['use data_layer_a::{', '    b::{c, d},', '    e,', '};'].join('\n');
		expect(pathTexts(code)).toEqual(['data_layer_a::b::c', 'data_layer_a::b::d', 'data_layer_a::e']);
	});

	it('reads self in a group as the path before the group', () => {
		expect(pathTexts('use data_layer_a::b::{self, c};')).toEqual(['data_layer_a::b', 'data_layer_a::b::c']);
	});

	it('reads a glob', () => {
		expect(pathTexts('use data_layer_a::*;')).toEqual(['data_layer_a::*']);
		expect(pathTexts('use crate::{app_data::*};')).toEqual(['crate::app_data::*']);
	});

	it('reads the name of a package that gets a new name, and a name of a group that gets a new name', () => {
		expect(pathTexts('use data_layer_a as other;')).toEqual(['data_layer_a']);
		expect(pathTexts('use data_layer_a::{find_x as other, find_y};')).toEqual([
			'data_layer_a::find_x',
			'data_layer_a::find_y',
		]);
	});

	it('does not read pub(crate) or a word that only starts like a package', () => {
		expect(pathTexts('pub(crate) fn f() { let data_layer_value = 1; }')).toEqual([]);
	});

	it('reads the path of heidrun_data', () => {
		expect(pathTexts('let guard = heidrun_data::lock_database(path)?;')).toEqual(['heidrun_data::lock_database']);
	});
});

describe('RustPaths.isPackageName', () => {
	it('is true for heidrun_data and for the names that start with data_layer_', () => {
		expect(RustPaths.isPackageName('heidrun_data')).toBe(true);
		expect(RustPaths.isPackageName('data_layer_code_hosting')).toBe(true);
		expect(RustPaths.isPackageName('crate')).toBe(false);
		expect(RustPaths.isPackageName('serde')).toBe(false);
	});

	it('is false for data_layer_operation_log, which gives no data', () => {
		expect(RustPaths.isPackageName('data_layer_operation_log')).toBe(false);
	});
});
