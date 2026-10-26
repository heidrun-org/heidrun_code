import { vi } from 'vitest';
import type { AgentView, CallResult, LaunchersAnswer, MacrosAnswer, Snapshot } from '../src/mobile_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FakeComputer — a fake computer that answers the calls of the page, and remembers them
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One call that the page sent to the fake computer. */
export type RecordedCall = {
	/** The name of the method. */
	method: string;
	/** The parameters of the method. */
	params: Record<string, unknown>;
	/** The pairing key that the call carried, or null. */
	key: string | null;
};

/**
 * Takes the place of the `fetch` of the page. It checks the pairing key like the mobile server does.
 */
export class FakeComputer {
	/** The pairing key that the fake computer accepts at the start. */
	static readonly key = 'a'.repeat(64);

	/** The answer of the method `state`. */
	snapshot: Snapshot;

	/** The answer of the method `read`. */
	outputText = 'first line\nlast line\n';

	/** True when the fake computer lets the phone type in a plain terminal, like the setting of Heidrun Code. */
	terminalTypingAllowed = true;

	/** The answer of the method `macros`. */
	macrosAnswer: MacrosAnswer = {
		macros: [],
	};

	/** The answer of the method `launchers`. */
	launchersAnswer: LaunchersAnswer = {
		workspaces: [],
	};

	/** Every call, in order. */
	calls: RecordedCall[] = [];

	/** The answers of the methods that change something, one list for each method. The last answer repeats. */
	answers: Record<string, CallResult[]> = {};

	/** True when the computer does not answer: the call of the page fails like a phone without a network. */
	isDown = false;

	/** The pairing key that the fake computer accepts now. */
	acceptedKey: string = FakeComputer.key;

	/**
	 * Creates a fake computer.
	 * @param snapshot The answer of the method `state`.
	 */
	constructor(snapshot: Snapshot) {
		this.snapshot = snapshot;
	}

	/**
	 * Builds one coding agent for a test.
	 * @param overrides The fields that differ from a working Claude Code in the workspace "heidrun".
	 * @returns The coding agent.
	 */
	static agent(overrides: Partial<AgentView>): AgentView {
		return {
			paneId: 'p-1',
			hasCodingAgent: true,
			name: 'Claude Code',
			kind: 'claude',
			workspace: 'heidrun',
			tab: 'fix-35',
			status: 'working',
			since: 1_000_000 - 120_000,
			question: null,
			context: 42,
			menu: null,
			...overrides,
		};
	}

	/**
	 * Builds an answer of the method `state` for a test.
	 * @param agents The coding agents, all in the workspace "heidrun".
	 * @param attention The identifiers of the panes that wait for the developer.
	 * @returns The answer.
	 */
	static snapshotOf(agents: AgentView[], attention: string[]): Snapshot {
		return {
			now: 1_000_000,
			terminalTypingAllowed: true,
			attention,
			workspaces: [
				{
					id: 'w-1',
					label: 'heidrun',
					agents,
				},
			],
			quotas: [],
		};
	}

	/**
	 * Replaces the `fetch` of the page by this fake computer.
	 */
	install(): void {
		vi.stubGlobal('fetch', (_address: string, init: RequestInit) => this._answer(init));
	}

	/**
	 * Lists the calls of one method.
	 * @param method The name of the method.
	 * @returns The calls, in order.
	 */
	callsOf(method: string): RecordedCall[] {
		return this.calls.filter((call) => call.method === method);
	}

	private async _answer(init: RequestInit): Promise<Response> {
		const body = JSON.parse(String(init.body)) as { method: string; params: Record<string, unknown> };
		const headers = init.headers as Record<string, string>;
		this.calls.push({
			method: body.method,
			params: body.params,
			key: headers['x-herdr-token'] ?? null,
		});
		if (this.isDown) {
			throw new TypeError('Failed to fetch');
		}
		if (headers['x-herdr-token'] !== this.acceptedKey) {
			return new Response('unpaired', { status: 401 });
		}
		if (body.method === 'state') {
			return Response.json({ ...this.snapshot, terminalTypingAllowed: this.terminalTypingAllowed });
		}
		if (body.method === 'read') {
			return Response.json({ text: this.outputText });
		}
		if (body.method === 'macros') {
			return Response.json(this.macrosAnswer);
		}
		if (body.method === 'launchers') {
			return Response.json(this.launchersAnswer);
		}
		const answers = this.answers[body.method] ?? [{ ok: true }];
		const answer = answers.length > 1 ? answers.shift() : answers[0];
		return Response.json(answer);
	}
}
