import {
	DESKTOP_SOURCE_FOLDER,
	FRONTEND_SOURCE_FOLDER,
	RUST_SCOPE_FILES,
	RUST_SCOPE_FOLDERS,
} from './boundary_rules.ts';
import type { BoundaryViolation } from './boundary_types.ts';
import { FrontendBoundaryCheck } from './frontend_boundary_check.ts';
import { RustBoundaryCheck } from './rust_boundary_check.ts';
import { SourceFiles } from './source_files.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DataLayerBoundaryChecker — checks that the Past chats sidebar section and the Statistics window get data from the data layer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Checks the whole repository. The Past chats sidebar section and the Statistics window get all their data through the packages
 * of the folder `submodules/heidrun_data/packages`. The desktop application and the web page may not read a conversation file, run Git or a
 * hosting tool, make a network request, or run SQL for these two parts.
 */
export class DataLayerBoundaryChecker {
	/**
	 * Checks the desktop application and the web page of a repository.
	 *
	 * @param repositoryPath - The path of the root of the repository.
	 * @returns Every place that gets data without a package of the data layer, in the order of the files.
	 */
	static check(repositoryPath: string): BoundaryViolation[] {
		return [
			...DataLayerBoundaryChecker.checkDesktop(repositoryPath),
			...DataLayerBoundaryChecker.checkFrontend(repositoryPath),
		];
	}

	/**
	 * Checks the Rust files and the manifest of the desktop application.
	 *
	 * @param repositoryPath - The path of the root of the repository.
	 * @returns Every place of the desktop application that gets data without a package of the data layer.
	 */
	static checkDesktop(repositoryPath: string): BoundaryViolation[] {
		const violations: BoundaryViolation[] = [];
		const scopeFilePaths = new Set<string>(RUST_SCOPE_FILES);
		for (const folderPath of RUST_SCOPE_FOLDERS) {
			for (const filePath of SourceFiles.list(repositoryPath, folderPath, ['.rs'])) {
				scopeFilePaths.add(filePath);
			}
		}
		for (const filePath of [...scopeFilePaths].sort()) {
			violations.push(...RustBoundaryCheck.checkScopeFile(filePath, SourceFiles.read(repositoryPath, filePath)));
		}
		for (const filePath of SourceFiles.list(repositoryPath, DESKTOP_SOURCE_FOLDER, ['.rs'])) {
			if (scopeFilePaths.has(filePath) === false) {
				violations.push(...RustBoundaryCheck.checkOutsideFile(filePath, SourceFiles.read(repositoryPath, filePath)));
			}
		}
		const manifestPath = 'packages/apps/desktop_tauri/Cargo.toml';
		violations.push(...RustBoundaryCheck.checkManifest(manifestPath, SourceFiles.read(repositoryPath, manifestPath)));
		return violations;
	}

	/**
	 * Checks the files of the web page that belong to the Past chats sidebar section or to the Statistics window.
	 *
	 * @param repositoryPath - The path of the root of the repository.
	 * @returns Every place of the web page that gets data without a package of the data layer.
	 */
	static checkFrontend(repositoryPath: string): BoundaryViolation[] {
		const violations: BoundaryViolation[] = [];
		const prefix = `${FRONTEND_SOURCE_FOLDER}/`;
		for (const filePath of SourceFiles.list(repositoryPath, FRONTEND_SOURCE_FOLDER, ['.ts', '.vue'])) {
			const relativePath = filePath.slice(prefix.length);
			if (FrontendBoundaryCheck.isInScope(relativePath) === true) {
				violations.push(
					...FrontendBoundaryCheck.check(filePath, relativePath, SourceFiles.read(repositoryPath, filePath)),
				);
			}
		}
		return violations;
	}

	/**
	 * Lists the web page files that the checks cover, so that a test can prove the list is not empty.
	 *
	 * @param repositoryPath - The path of the root of the repository.
	 * @returns The paths of the files relative to the root of the repository.
	 */
	static listFrontendScopeFiles(repositoryPath: string): string[] {
		const prefix = `${FRONTEND_SOURCE_FOLDER}/`;
		return SourceFiles.list(repositoryPath, FRONTEND_SOURCE_FOLDER, ['.ts', '.vue']).filter((filePath) => {
			return FrontendBoundaryCheck.isInScope(filePath.slice(prefix.length));
		});
	}

	/**
	 * Lists the Rust files that the checks cover as the scope, so that a test can prove the list is not empty.
	 *
	 * @param repositoryPath - The path of the root of the repository.
	 * @returns The paths of the files relative to the root of the repository.
	 */
	static listRustScopeFiles(repositoryPath: string): string[] {
		const filePaths = new Set<string>(RUST_SCOPE_FILES);
		for (const folderPath of RUST_SCOPE_FOLDERS) {
			for (const filePath of SourceFiles.list(repositoryPath, folderPath, ['.rs'])) {
				filePaths.add(filePath);
			}
		}
		return [...filePaths].sort();
	}

	/**
	 * Writes the violations as text for the failure message of a test.
	 *
	 * @param violations - The violations to write.
	 * @returns One line for each violation, with the file, the line, the rule, and the message.
	 */
	static describe(violations: BoundaryViolation[]): string {
		return violations
			.map((violation) => {
				return `${violation.filePath}:${violation.lineNumber} [${violation.ruleId}] ${violation.message}\n    ${violation.excerpt}`;
			})
			.join('\n');
	}
}
