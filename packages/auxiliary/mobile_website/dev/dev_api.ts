import type { AgentView, CallResult, LaunchersAnswer, LauncherView, MacrosAnswer, Snapshot } from '../src/mobile_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DevApi — a fake computer for the development server: four coding agents that answer the calls of the page
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The answer of the fake computer to one call: the HTTP status and the JSON body. */
export type DevApiReply = {
	/** The HTTP status of the answer. */
	status: number;
	/** The body of the answer. A text for an error, an object for an answer that worked. */
	body: unknown;
};

/**
 * Answers the calls of the page like the mobile server does, with made-up coding agents, so the developer works on
 * the page without the desktop application. It keeps its state in memory: an answer to a menu makes the coding
 * agent work again, and a prompt appears in the output of the pane.
 */
export class DevApi {
	/** The pairing key that the development server prints in its address. Any other valid key works too. */
	static readonly pairingKey = '0123456789abcdef'.repeat(4);

	/** The closed list of methods, the same as the list of the mobile server. */
	private static readonly methods = ['state', 'read', 'answer', 'prompt', 'keys', 'macros', 'launchers', 'launch', 'pushKey', 'subscribe', 'unsubscribe'];

	/** The command that the fake computer asks the developer to check once more, like the guards of Heidrun Code do. */
	private static readonly dangerousCommand = 'rm -rf build';

	/** The coding agents, which change when the developer answers. */
	private readonly agents: AgentView[];

	/** The launchers of the workspace "heidrun", which change when the developer runs or stops one. */
	private readonly launchers: LauncherView[] = [
		{
			id: 'dev',
			label: 'Dev server',
			description: 'Starts Heidrun Code with pnpm dev',
			command: 'pnpm dev',
			status: 'idle',
		},
		{
			id: 'clean',
			label: 'Clean',
			description: null,
			command: DevApi.dangerousCommand,
			status: 'finished',
		},
	];

	/** The prompts that the developer sent, for each pane. */
	private readonly prompts = new Map<string, string[]>();

	/**
	 * Creates a fake computer with four coding agents.
	 * @param now The time that the changes of status are counted from, in milliseconds since 1970.
	 */
	constructor(now: number = Date.now()) {
		this.agents = [
			DevApi.agent(now, {
				paneId: 'p-blocked',
				status: 'blocked',
				since: now - 3 * 60_000,
				menu: {
					question: 'Run this command?',
					detail: DevApi.dangerousCommand,
					options: [
						{
							n: 1,
							label: 'Yes',
						},
						{
							n: 2,
							label: 'Yes, and do not ask again',
						},
						{
							n: 3,
							label: 'No',
						},
					],
				},
			}),
			DevApi.agent(now, {
				paneId: 'p-asking',
				tab: 'review-12',
				status: 'done',
				since: now - 9 * 60_000,
				question: 'Which file should I change?',
			}),
			DevApi.agent(now, {
				paneId: 'p-working',
				name: 'Codex',
				kind: 'codex',
				status: 'working',
				since: now - 40_000,
			}),
			DevApi.agent(now, {
				paneId: 'p-finished',
				tab: 'docs',
				status: 'done',
				since: now - 52 * 60_000,
			}),
			DevApi.agent(now, {
				paneId: 'p-terminal',
				hasCodingAgent: false,
				name: 'zsh',
				kind: 'Terminal',
				tab: 'shell',
				status: 'unknown',
				since: null,
				context: null,
			}),
		];
	}

	/**
	 * Answers one HTTP call of the page.
	 * @param pairingKey The value of the header `x-herdr-token`, or null when the header is missing.
	 * @param body The JSON text of the body of the request.
	 * @returns The status and the body of the answer.
	 */
	handle(pairingKey: string | null, body: string): DevApiReply {
		if (pairingKey === null || /^[0-9a-f]{64}$/.test(pairingKey) === false) {
			return {
				status: 401,
				body: 'Pairing needed: scan the QR code in Heidrun Code',
			};
		}
		let request: { method?: unknown; params?: unknown };
		try {
			request = JSON.parse(body) as { method?: unknown; params?: unknown };
		} catch {
			return {
				status: 400,
				body: 'Invalid request',
			};
		}
		const method = typeof request.method === 'string' ? request.method : '';
		if (DevApi.methods.includes(method) === false) {
			return {
				status: 400,
				body: 'Unknown method',
			};
		}
		const isObject = typeof request.params === 'object' && request.params !== null;
		const params = (isObject ? request.params : {}) as Record<string, unknown>;
		return {
			status: 200,
			body: this.call(method, params),
		};
	}

	/**
	 * Answers one call, after the checks of the request.
	 * @param method The name of the method, in the closed list.
	 * @param params The parameters of the method.
	 * @returns The answer of the method.
	 */
	call(method: string, params: Record<string, unknown>): Snapshot | MacrosAnswer | LaunchersAnswer | CallResult {
		const paneId = String(params.paneId ?? '');
		const agent = this.agents.find((candidate) => candidate.paneId === paneId) ?? null;
		if (method === 'state') {
			return this.snapshot();
		}
		if (method === 'pushKey') {
			return {
				key: 'BDevelopmentServerHasNoPushKey',
			};
		}
		if (method === 'subscribe' || method === 'unsubscribe') {
			return {
				ok: true,
			};
		}
		if (method === 'launchers') {
			return {
				workspaces: [
					{
						id: 'w-1',
						label: 'heidrun',
						error: null,
						launchers: this.launchers,
					},
				],
			};
		}
		if (method === 'launch') {
			return this.launch(params);
		}
		if (agent === null) {
			return {
				error: 'This pane does not exist anymore.',
			};
		}
		if (method === 'read') {
			return {
				text: this.output(agent),
			};
		}
		if (agent.hasCodingAgent === false && method !== 'read' && method !== 'prompt') {
			return {
				error: 'This pane is a terminal: the phone can only read it, or type a command in it',
			};
		}
		if (agent.hasCodingAgent === false && method === 'prompt') {
			return this.typeInTerminal(agent, params);
		}
		if (method === 'macros') {
			return DevApi.macros(agent);
		}
		if (method === 'prompt') {
			this.prompts.set(paneId, [...(this.prompts.get(paneId) ?? []), String(params.text ?? '')]);
			this.setWorking(agent);
			return {
				ok: true,
			};
		}
		if (method === 'keys') {
			return {
				ok: true,
			};
		}
		return this.answer(agent, params);
	}

	private static agent(now: number, overrides: Partial<AgentView>): AgentView {
		return {
			paneId: 'p-1',
			hasCodingAgent: true,
			name: 'Claude Code',
			kind: 'claude',
			workspace: 'heidrun',
			tab: 'fix-35',
			status: 'working',
			since: now,
			question: null,
			context: 42,
			menu: null,
			...overrides,
		};
	}

	private static macros(agent: AgentView): MacrosAnswer {
		return {
			macros: [
				{
					id: 'progress',
					label: 'Progress',
					description: 'Asks the coding agent where it is',
					source: 'personal',
					text: `Where are you, ${agent.name}? Answer in 5 lines.`,
				},
				{
					id: 'review',
					label: 'Review the branch',
					description: '',
					source: 'project',
					text: `Review the branch of ${agent.tab}: security, bugs, tests.`,
				},
			],
		};
	}

	private typeInTerminal(agent: AgentView, params: Record<string, unknown>): CallResult {
		const text = String(params.text ?? '');
		if (text.includes('rm -rf') && (params.confirmed !== true || params.command !== text)) {
			return {
				confirm: {
					command: text,
					why: 'The command deletes files. Check it before it runs.',
				},
			};
		}
		this.prompts.set(agent.paneId, [...(this.prompts.get(agent.paneId) ?? []), text]);
		return {
			ok: true,
		};
	}

	private launch(params: Record<string, unknown>): CallResult {
		const launcher = this.launchers.find((candidate) => candidate.id === params.launcherId);
		if (launcher === undefined) {
			return {
				error: 'Launcher not found (removed?): refresh',
			};
		}
		if (params.action === 'stop') {
			launcher.status = 'finished';
			return {
				ok: true,
			};
		}
		if (launcher.command === DevApi.dangerousCommand && params.confirmed !== true) {
			return {
				confirm: {
					command: launcher.command,
					why: 'The command deletes files. Check it before it runs.',
				},
			};
		}
		launcher.status = 'running';
		return {
			ok: true,
		};
	}

	private snapshot(): Snapshot {
		const attention = this.agents
			.filter((agent) => agent.status === 'blocked' || agent.question !== null)
			.map((agent) => agent.paneId);
		return {
			now: Date.now(),
			terminalTypingAllowed: true,
			attention,
			workspaces: [
				{
					id: 'w-1',
					label: 'heidrun',
					agents: this.agents,
				},
			],
			quotas: [
				{
					name: '5-hour limit',
					percent: 42,
				},
				{
					name: 'Weekly limit',
					percent: 62,
				},
			],
		};
	}

	private answer(agent: AgentView, params: Record<string, unknown>): CallResult {
		const isDangerous = agent.menu?.detail === DevApi.dangerousCommand && Number(params.n) !== 3;
		if (isDangerous && params.confirmed !== true) {
			return {
				confirm: {
					command: DevApi.dangerousCommand,
					why: 'The command deletes files. Check it before the coding agent runs it.',
				},
			};
		}
		this.setWorking(agent);
		return {
			ok: true,
		};
	}

	private setWorking(agent: AgentView): void {
		agent.status = 'working';
		agent.since = Date.now();
		agent.menu = null;
		agent.question = null;
	}

	/**
	 * Draws the screen of a pane: a header, a colored list, the prompts of the developer, and an input box.
	 * @param agent The coding agent of the pane.
	 * @returns The text of the screen, with the color codes of a terminal.
	 */
	private output(agent: AgentView): string {
		const code = (codes: string, text: string): string => `\u001b[${codes}m${text}\u001b[0m`;
		if (agent.hasCodingAgent === false) {
			const typed = (this.prompts.get(agent.paneId) ?? []).map((command) => `$ ${command}`);
			return [
				`${code('1;32', 'jerome@computer')} ${code('1;34', '~/webwork/heidrun')} $ git status`,
				'On branch dev_jerome',
				code('32', 'nothing to commit, working tree clean'),
				...typed,
			].join('\r\n');
		}
		const blue = '38;2;99;168;248';
		const gray = '48;2;30;30;30';
		const prompts = this.prompts.get(agent.paneId) ?? [];
		const sent = prompts.map((prompt) => `${code(`1;${blue}`, '›')} ${prompt}`);
		const results = [code('32', '✔ passed'), code('31', '✘ failed'), code('33', '! warning')];
		const effects = [code('1', 'bold'), code('3', 'italic'), code('4', 'underline'), code('9', 'strike')];
		return [
			`  ${code(blue, '>_ ')}${code('1', agent.name)}${code('2', ' (made-up screen)')}`,
			'',
			results.join('  '),
			[...effects, code('7', ' inverse ')].join(' '),
			'',
			...sent,
			code(gray, ' '.repeat(60)),
			`${code(`1;${gray}`, '›')}${code(gray, ' ')}${code(`2;${gray}`, `Ask ${agent.name}`)}`,
			code('38;2;119;119;119', `${agent.workspace} · ${agent.tab}`),
		].join('\r\n');
	}
}
