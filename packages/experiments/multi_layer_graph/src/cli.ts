#!/usr/bin/env tsx
// Writes the file graph.json of the multi-layer graph from the SQLite file of the data layer packages.
// pnpm --filter multi_layer_graph graph:build
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { Command } from 'commander';
import { DataLayerReader } from './builder/data_layer_reader.ts';
import { GraphBuilder } from './builder/graph_builder.ts';
import type { MultiLayerGraph } from './graph/multi_layer_graph_types.ts';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Cli — the command line that writes the file graph.json
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The options of the command line, after Commander reads them.
 */
type CliOptions = {
	/** The path of the SQLite file of the data layer packages. */
	database: string;
	/** The repository, in the format "owner/name". */
	repository: string;
	/** The path of the file graph.json to write. */
	output: string;
};

/**
 * The command line of the package `multi_layer_graph`: reads the SQLite file of the data layer packages, builds the
 * multi-layer graph, and writes the file graph.json.
 */
export class Cli {
	/** The repository that the command line reads when the option `--repository` is not given. */
	static readonly DEFAULT_REPOSITORY = 'heidrun-org/heidrun';

	/** The SQLite file that the command line reads when the option `--database` is not given. */
	static readonly DEFAULT_DATABASE_PATH = Path.join(Cli._defaultDataFolder(), 'data_layer.sqlite');

	/** The file that the command line writes when the option `--output` is not given. The page reads this file. */
	static readonly DEFAULT_OUTPUT_PATH = Path.join(__dirname, '..', 'public', 'graph.json');

	/** The command of the data layer package that fills each table, by table name. */
	private static readonly _FILL_COMMANDS: Record<string, string> = {
		issues: 'pnpm --silent data_layer:code_hosting initialize',
		pull_requests: 'pnpm --silent data_layer:code_hosting initialize',
		commits: 'pnpm --silent data_layer:source_control initialize',
	};

	/**
	 * Parses the command line, writes the file graph.json, and prints a report on the standard error output. When an
	 * error happens, prints the message on the standard error output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 */
	static main(argv: string[]): void {
		const program = new Command();
		program
			.name('pnpm --filter multi_layer_graph graph:build')
			.description(
				'Reads the SQLite file of the data layer packages, read only, builds the multi-layer graph of one '
					+ 'repository, and writes it in a JSON file. The page of the experiment reads this file.',
			)
			.option('--database <path>', 'The SQLite file of the data layer packages.', Cli.DEFAULT_DATABASE_PATH)
			.option('--repository <owner/name>', 'The repository.', Cli.DEFAULT_REPOSITORY)
			.option('--output <path>', 'The JSON file to write.', Cli.DEFAULT_OUTPUT_PATH)
			.action((cliOptions: CliOptions) => {
				Cli._run(cliOptions);
			});
		program.parse(argv);
	}

	/**
	 * Builds the multi-layer graph and writes it.
	 * @param cliOptions The options of the command line.
	 */
	private static _run(cliOptions: CliOptions): void {
		try {
			const multiLayerGraph = Cli._build(cliOptions);
			Fs.mkdirSync(Path.dirname(cliOptions.output), {
				recursive: true,
			});
			Fs.writeFileSync(cliOptions.output, `${JSON.stringify(multiLayerGraph)}\n`);
			const layerCounts = multiLayerGraph.layers.map(
				(graphLayer) => `${graphLayer.nodeCount} ${graphLayer.name}`,
			);
			process.stderr.write(
				`Wrote ${cliOptions.output}: ${multiLayerGraph.nodes.length} nodes (${layerCounts.join(', ')}), `
					+ `${multiLayerGraph.links.length} links.\n`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}

	/**
	 * Reads the rows of the repository, and builds the multi-layer graph.
	 * @param cliOptions The options of the command line.
	 * @returns The multi-layer graph.
	 */
	private static _build(cliOptions: CliOptions): MultiLayerGraph {
		if (Fs.existsSync(cliOptions.database) === false) {
			const commands = [...new Set(Object.values(Cli._FILL_COMMANDS))];
			throw new Error(
				`The SQLite file ${cliOptions.database} does not exist. Fill it first, at the root of the `
					+ `repository:\n${commands.map((command) => `  ${command}`).join('\n')}`,
			);
		}
		const reader = new DataLayerReader(cliOptions.database);
		try {
			const issueRows = reader.readIssues(cliOptions.repository);
			const pullRequestRows = reader.readPullRequests(cliOptions.repository);
			const commitRows = reader.readCommits(cliOptions.repository);
			const emptyTableNames = Object.entries({
				issues: issueRows.length,
				pull_requests: pullRequestRows.length,
				commits: commitRows.length,
			}).filter(([, rowCount]) => rowCount === 0).map(([tableName]) => tableName);
			if (emptyTableNames.length === 3) {
				throw new Error(
					`The SQLite file ${cliOptions.database} has no row for the repository ${cliOptions.repository}. `
						+ `Fill it first, at the root of the repository:\n${Cli._commandLines(emptyTableNames)}`,
				);
			}
			if (emptyTableNames.length > 0) {
				process.stderr.write(
					`Warning: no row for the repository ${cliOptions.repository} in the tables `
						+ `${emptyTableNames.join(', ')}. To fill them, at the root of the repository:\n`
						+ `${Cli._commandLines(emptyTableNames)}\n`,
				);
			}
			const multiLayerGraph = GraphBuilder.build({
				repository: cliOptions.repository,
				builtAt: new Date().toISOString(),
				issueRows,
				pullRequestRows,
				commitRows,
			});
			return multiLayerGraph;
		} finally {
			reader.close();
		}
	}

	/**
	 * Writes the commands that fill some tables, one command for each line.
	 * @param tableNames The names of the tables.
	 * @returns The lines of the commands, each command one time.
	 */
	private static _commandLines(tableNames: string[]): string {
		const commands = [...new Set(tableNames.map((tableName) => Cli._FILL_COMMANDS[tableName]))];
		const commandLines = commands.map((command) => `  ${command}`).join('\n');
		return commandLines;
	}

	/**
	 * Gives `~/.config/heidrun_code`, or the former folder `~/.config/heidrun` when it exists and the new folder does not.
	 * @returns The folder that holds the SQLite file of the data layer packages.
	 */
	private static _defaultDataFolder(): string {
		const current = Path.join(Os.homedir(), '.config', 'heidrun_code');
		const former = Path.join(Os.homedir(), '.config', 'heidrun');
		if (Fs.existsSync(current) === false && Fs.existsSync(former)) {
			return former;
		}
		return current;
	}
}

if (process.argv[1] === __filename) {
	Cli.main(process.argv);
}
