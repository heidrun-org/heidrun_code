// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIRE_OBSERVATIONS_STALE_AFTER_MS, MireModelBuilder } from './mire_model_builder';
import type { MireCodingAgentNode, MireModel } from './mire_model_types';
import { MireTestFixtures, NOW_MS } from './mire_test_fixtures';

const fixtures = MireTestFixtures;

/** One workspace with one tab, the usual frame of a test. */
const FRAME = {
	workspaces: [fixtures.workspace('w1', 1, 'heidrun')],
	tabs: [fixtures.tab('w1:t1', 'w1', 1, 'Fix the bug')],
};

/**
 * Gives every coding agent of a model.
 * @param model The model.
 * @returns The coding agents, in the order of the hierarchy.
 */
function codingAgents(model: MireModel): MireCodingAgentNode[] {
	return model.workspaces.flatMap((workspace) => workspace.tabs.flatMap((tab) => tab.codingAgents));
}

describe('MireModelBuilder: hierarchy and identity', () => {
	it('builds Heidrun, the workspaces by number, the tabs by number, and one coding agent for each agent pane', () => {
		const model = MireModelBuilder.build(fixtures.input({
			workspaces: [fixtures.workspace('w2', 2, 'second'), fixtures.workspace('w1', 1, 'first')],
			tabs: [
				fixtures.tab('w1:t2', 'w1', 2, 'Tab two'),
				fixtures.tab('w1:t1', 'w1', 1, 'Tab one'),
				fixtures.tab('w2:t1', 'w2', 1, 'Tab one'),
			],
			panes: [
				fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
					agent: 'claude',
				}),
				fixtures.pane('w1:p2', 'term_b', 'w1:t2', {
					agent: 'codex',
				}),
				fixtures.pane('w2:p1', 'term_c', 'w2:t1'),
			],
		}));
		expect(model.nodeId).toBe('heidrun');
		expect(model.herdrSessionName).toBe('heidrun_development');
		expect(model.workspaces.map((workspace) => workspace.nodeId)).toEqual(['workspace:w1', 'workspace:w2']);
		expect(model.workspaces[0].folder).toBe('/projects/first');
		expect(model.workspaces[0].tabs.map((tab) => tab.label)).toEqual(['Tab one', 'Tab two']);
		expect(model.workspaces[0].tabs[0].codingAgents[0].nodeId).toBe('coding_agent:term_a:claude');
		expect(model.workspaces[1].tabs[0].codingAgents).toEqual([]);
		expect(model.observationsState).toBe('none');
	});

	it('shows each coding agent separately when a tab has several coding agent panes', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [
				fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
					agent: 'claude',
					agent_status: 'working',
				}),
				fixtures.pane('w1:p2', 'term_b', 'w1:t1', {
					agent: 'claude',
					agent_status: 'blocked',
				}),
				fixtures.pane('w1:p3', 'term_c', 'w1:t1', {
					agent: 'codex',
					agent_status: 'done',
				}),
			],
		}));
		const tab = model.workspaces[0].tabs[0];
		expect(tab.codingAgents.map((codingAgent) => [codingAgent.paneId, codingAgent.status])).toEqual([
			['w1:p1', 'working'],
			['w1:p2', 'blocked'],
			['w1:p3', 'finished'],
		]);
		expect(tab.status).toBe('blocked');
		expect(model.counters.codingAgents.total).toBe(3);
	});

	it('follows a moved pane to its new workspace and tab, with the same node identifier', () => {
		const before = MireModelBuilder.build(fixtures.input({
			workspaces: [fixtures.workspace('w1', 1, 'one'), fixtures.workspace('w2', 2, 'two')],
			tabs: [fixtures.tab('w1:t2', 'w1', 1, 'Probe'), fixtures.tab('w2:t1', 'w2', 1, 'Other')],
			panes: [fixtures.pane('w1:p2', 'term_65f02ac015cc02', 'w1:t2', {
				agent: 'codex',
			})],
		}));
		const after = MireModelBuilder.build(fixtures.input({
			workspaces: [fixtures.workspace('w1', 1, 'one'), fixtures.workspace('w2', 2, 'two')],
			tabs: [fixtures.tab('w2:t1', 'w2', 1, 'Other'), fixtures.tab('w2:t2', 'w2', 2, 'Codex moved probe')],
			panes: [fixtures.pane('w2:p2', 'term_65f02ac015cc02', 'w2:t2', {
				agent: 'codex',
			})],
		}));
		const moved = codingAgents(after)[0];
		expect(moved.nodeId).toBe(codingAgents(before)[0].nodeId);
		expect([moved.paneId, moved.workspaceId, moved.tabId]).toEqual(['w2:p2', 'w2', 'w2:t2']);
		expect(after.workspaces[0].tabs).toEqual([]);
		expect(after.workspaces[1].tabs[1].codingAgents).toHaveLength(1);
	});

	it('keeps a terminal whose coding agent stopped out of the coding agents, and gives a new node to a new agent', () => {
		const pane = fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
			agent: 'claude',
			tokens: {
				hd_sid: 'old',
			},
		});
		const stopped = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [{
				...pane,
				agent: null,
			}],
		}));
		expect(codingAgents(stopped)).toEqual([]);
		const replaced = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [{
				...pane,
				agent: 'codex',
			}],
		}));
		expect(codingAgents(replaced)[0].nodeId).toBe('coding_agent:term_a:codex');
	});

	it('keeps two tabs and two subagents with the same names in different workspaces separate', () => {
		const model = MireModelBuilder.build(fixtures.input({
			workspaces: [fixtures.workspace('w1', 1, 'same'), fixtures.workspace('w2', 2, 'same')],
			tabs: [fixtures.tab('w1:t1', 'w1', 1, 'Review'), fixtures.tab('w2:t1', 'w2', 1, 'Review')],
			panes: [
				fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
					agent: 'claude',
					tokens: {
						hd_sid: 's1',
					},
				}),
				fixtures.pane('w2:p1', 'term_b', 'w2:t1', {
					agent: 'claude',
					tokens: {
						hd_sid: 's2',
					},
				}),
			],
			observations: fixtures.observations({
				sessions: [
					fixtures.claudeSession('s1', {
						subagents: [fixtures.claudeSubagent('a1', {
							description: 'reviewer',
						})],
					}),
					fixtures.claudeSession('s2', {
						subagents: [fixtures.claudeSubagent('a1', {
							description: 'reviewer',
						})],
					}),
				],
			}),
		}));
		const tabNodeIds = model.workspaces.map((workspace) => workspace.tabs[0].nodeId);
		expect(new Set(tabNodeIds).size).toBe(2);
		const subagentNodeIds = codingAgents(model).map((codingAgent) => codingAgent.subagents[0].nodeId);
		expect(subagentNodeIds).toEqual(['subagent:claude:s1:a1', 'subagent:claude:s2:a1']);
		expect(model.counters.subagents.total).toBe(2);
	});
});

describe('MireModelBuilder: Claude Code matching', () => {
	it('links a session through hd_sid, and never through the folder', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
				agent: 'claude',
				cwd: '/projects',
				tokens: {
					hd_sid: 's1',
				},
			})],
			observations: fixtures.observations({
				sessions: [fixtures.claudeSession('other', {
					cwd: '/projects',
				}), fixtures.claudeSession('s1')],
			}),
		}));
		const codingAgent = codingAgents(model)[0];
		expect(codingAgent.chat).toEqual({
			chatId: 's1',
			state: 'matched',
		});
		expect(codingAgent.facts.freshness).toBe('fresh');
		expect(codingAgent.observedSinceMs).toBe(NOW_MS - 60_000);
		expect(model.unmatchedObservations.claudeSessionIds).toEqual(['other']);
	});

	it('links a session through the pane identifier only with the same Herdr socket', () => {
		const pane = fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
			agent: 'claude',
		});
		const sameSocket = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [pane],
			observations: fixtures.observations({
				sessions: [fixtures.claudeSession('s1', {
					herdrPaneId: 'w1:p1',
				})],
			}),
		}));
		expect(codingAgents(sameSocket)[0].chat.state).toBe('matched');
		const otherSocket = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [pane],
			observations: fixtures.observations({
				sessions: [fixtures.claudeSession('s1', {
					herdrPaneId: 'w1:p1',
					herdrSocketPath: '/tmp/herdr_installed.sock',
				})],
			}),
		}));
		expect(codingAgents(otherSocket)[0].chat.state).toBe('not_observed');
		const unknownSocket = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [pane],
			herdrSocketPath: null,
			observations: fixtures.observations({
				sessions: [fixtures.claudeSession('s1', {
					herdrPaneId: 'w1:p1',
				})],
			}),
		}));
		expect(codingAgents(unknownSocket)[0].chat.state).toBe('not_observed');
	});

	it('shows a pane with no observed session as not observed, with the status of Herdr', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
				agent: 'claude',
				agent_status: 'working',
				tokens: {
					hd_sid: 's1',
				},
			})],
			observations: null,
		}));
		const codingAgent = codingAgents(model)[0];
		expect(codingAgent.chat).toEqual({
			chatId: 's1',
			state: 'not_observed',
		});
		expect(codingAgent.status).toBe('working');
		expect(codingAgent.notices).toEqual(['not_observed']);
		expect(model.coverage.notObserved).toBe(1);
	});

	it('marks a stale session stale, keeps the status of Herdr for the pane, and gives unknown to its subagents', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
				agent: 'claude',
				agent_status: 'working',
				tokens: {
					hd_sid: 's1',
				},
			})],
			observations: fixtures.observations({
				sessions: [fixtures.claudeSession('s1', {
					isStale: true,
					subagents: [fixtures.claudeSubagent('a1')],
				})],
			}),
		}));
		const codingAgent = codingAgents(model)[0];
		expect(codingAgent.status).toBe('working');
		expect(codingAgent.facts.freshness).toBe('stale');
		const subagent = codingAgent.subagents[0];
		expect(subagent.status).toBe('unknown');
		expect(subagent.facts.nativeStatus).toEqual({
			source: 'claude_observer',
			value: 'running',
		});
		expect(subagent.notices).toEqual(['unknown_status', 'stale']);
		expect(model.coverage).toEqual({
			total: 2,
			unknown: 1,
			stale: 2,
			unmatched: 0,
			notObserved: 0,
		});
	});

	it('marks every observation stale when the last collection is too old', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
				agent: 'claude',
				tokens: {
					hd_sid: 's1',
				},
			})],
			nowMs: NOW_MS + MIRE_OBSERVATIONS_STALE_AFTER_MS + 1,
			observations: fixtures.observations({
				sessions: [fixtures.claudeSession('s1', {
					subagents: [fixtures.claudeSubagent('a1', {
						nativeStatus: 'completed',
					})],
				})],
			}),
		}));
		expect(model.observationsState).toBe('stale');
		expect(codingAgents(model)[0].subagents[0].status).toBe('unknown');
		expect(codingAgents(model)[0].facts.freshness).toBe('stale');
	});
});

describe('MireModelBuilder: Codex matching', () => {
	const codexPane = (chatId: string | null) => fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
		agent: 'codex',
		agent_status: 'working',
		agent_session: chatId === null ? null : {
			source: 'herdr',
			agent: 'codex',
			kind: 'thread',
			value: chatId,
		},
	});

	it('shows a Codex pane with no agent_session as unmatched, even when a chat has the same folder', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [codexPane(null)],
			observations: fixtures.observations({
				threads: [fixtures.codexThread('r1', 'r1', null)],
			}),
		}));
		const codingAgent = codingAgents(model)[0];
		expect(codingAgent.chat).toEqual({
			chatId: null,
			state: 'unmatched',
		});
		expect(codingAgent.notices).toEqual(['unmatched']);
		expect(model.unmatchedObservations.codexRootThreadIds).toEqual(['r1']);
		expect(model.coverage.unmatched).toBe(1);
	});

	it('shows a Codex pane whose root chat is not observed as unmatched, and as not observed when the server is down', () => {
		const connected = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [codexPane('r1')],
			observations: fixtures.observations(),
		}));
		expect(codingAgents(connected)[0].chat).toEqual({
			chatId: 'r1',
			state: 'unmatched',
		});
		const unavailable = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [codexPane('r1')],
			observations: fixtures.observations({
				coverage: 'unavailable',
			}),
		}));
		expect(codingAgents(unavailable)[0].chat.state).toBe('not_observed');
		expect(unavailable.codexCoverage).toBe('unavailable');
		expect(unavailable.codexUnavailableReason).toBe('no socket');
	});

	it('marks the chat identifier stale when the root chat is notLoaded while the pane names it', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [codexPane('r1')],
			observations: fixtures.observations({
				threads: [
					fixtures.codexThread('r1', 'r1', null, {
						nativeStatus: 'notLoaded',
					}),
					fixtures.codexThread('c1', 'r1', 'r1'),
				],
			}),
		}));
		const codingAgent = codingAgents(model)[0];
		expect(codingAgent.chat).toEqual({
			chatId: 'r1',
			state: 'stale',
		});
		expect(codingAgent.facts.freshness).toBe('stale');
		expect(codingAgent.notices).toContain('stale_chat');
		expect(codingAgent.subagents).toEqual([]);
	});

	it('nests the Codex children by parent and keeps the runtime status and the outcome separate', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [codexPane('r1')],
			observations: fixtures.observations({
				threads: [
					fixtures.codexThread('r1', 'r1', null),
					fixtures.codexThread('c1', 'r1', 'r1', {
						nickname: 'explorer',
						nativeStatus: 'idle',
						lastTurn: {
							status: 'completed',
							completedAtMs: NOW_MS - 10,
						},
					}),
					fixtures.codexThread('c2', 'r1', 'c1', {
						nativeStatus: 'idle',
						lastTurn: {
							status: 'failed',
							completedAtMs: NOW_MS - 5,
						},
					}),
					fixtures.codexThread('c3', 'r1', 'missing'),
				],
				truncatedRootThreadIds: ['r1'],
			}),
		}));
		const codingAgent = codingAgents(model)[0];
		expect(codingAgent.chat.state).toBe('matched');
		expect(codingAgent.status).toBe('working');
		expect(codingAgent.notices).toEqual(['children_truncated']);
		const [explorer, orphan] = codingAgent.subagents;
		expect(explorer.nodeId).toBe('subagent:codex:c1');
		expect(explorer.status).toBe('finished');
		expect(explorer.facts.nativeStatus?.value).toBe('idle');
		expect(explorer.facts.lastTurnOutcome).toBe('completed');
		expect(explorer.notices).toEqual([]);
		expect(explorer.children[0].parentNodeId).toBe('subagent:codex:c1');
		expect(explorer.children[0].status).toBe('finished');
		expect(explorer.children[0].notices).toEqual(['failed']);
		expect(orphan.nativeId).toBe('c3');
		expect(orphan.parentNodeId).toBe(codingAgent.nodeId);
		expect(orphan.notices).toEqual(['parent_not_observed']);
		expect(model.counters.subagents).toEqual({
			working: 1,
			blocked: 0,
			finished: 2,
			idle: 0,
			unknown: 0,
			total: 3,
		});
		expect(model.unmatchedObservations.codexRootThreadIds).toEqual([]);
	});
});

describe('MireModelBuilder: pending attention', () => {
	it('links a Claude Code request to the coding agent or to the subagent, with the context of the reviewer', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
				agent: 'claude',
				agent_status: 'blocked',
				tokens: {
					hd_sid: 's1',
				},
			})],
			observations: fixtures.observations({
				sessions: [fixtures.claudeSession('s1', {
					subagents: [fixtures.claudeSubagent('a1', {
						type: 'code-reviewer',
					})],
					pendingRequests: [
						{
							id: 'q1',
							agentId: null,
							kind: 'question',
							tool: 'AskUserQuestion',
							summary: 'Which branch?',
							atMs: NOW_MS,
						},
						{
							id: 'p1',
							agentId: 'a1',
							kind: 'approval',
							tool: 'Bash',
							summary: 'rm -rf build',
							atMs: NOW_MS,
						},
					],
				})],
			}),
		}));
		const codingAgent = codingAgents(model)[0];
		expect(codingAgent.facts.pendingAttention.map((attention) => attention.id)).toEqual(['claude:s1:q1']);
		expect(codingAgent.facts.pendingAttention[0].reviewerContext).toBeNull();
		expect(codingAgent.facts.pendingAttention[0].developerAction).toBe('required');
		const subagent = codingAgent.subagents[0];
		expect(subagent.status).toBe('blocked');
		expect(subagent.facts.nativeStatus?.value).toBe('running');
		expect(subagent.facts.pendingAttention[0].requester).toEqual({
			nodeId: 'subagent:claude:s1:a1',
			kind: 'subagent',
			nativeId: 'a1',
			role: 'code-reviewer',
			name: 'subagent a1',
		});
		expect(subagent.facts.pendingAttention[0].reviewerContext).toEqual({
			parentNodeId: codingAgent.nodeId,
			requesterRole: 'code-reviewer',
		});
	});

	it('does not treat a Codex approval flag as a request for the developer', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
				agent: 'codex',
				agent_status: 'working',
				agent_session: {
					source: 'herdr',
					agent: 'codex',
					kind: 'thread',
					value: 'r1',
				},
			})],
			observations: fixtures.observations({
				threads: [
					fixtures.codexThread('r1', 'r1', null),
					fixtures.codexThread('c1', 'r1', 'r1', {
						role: 'worker',
						activeFlags: ['waitingOnApproval'],
					}),
				],
			}),
		}));
		const codingAgent = codingAgents(model)[0];
		const child = codingAgent.subagents[0];
		expect(child.status).toBe('blocked');
		expect(child.facts.pendingAttention).toEqual([{
			id: 'codex:c1:waitingOnApproval',
			kind: 'approval',
			source: 'codex_server',
			tool: null,
			summary: null,
			atMs: null,
			requester: {
				nodeId: 'subagent:codex:c1',
				kind: 'subagent',
				nativeId: 'c1',
				role: 'worker',
				name: null,
			},
			reviewerContext: {
				parentNodeId: codingAgent.nodeId,
				requesterRole: 'worker',
			},
			developerAction: 'unknown',
			isStale: false,
		}]);
		expect(codingAgent.status).toBe('working');
		expect(model.workspaces[0].tabs[0].status).toBe('blocked');
		expect(model.status).toBe('blocked');
	});
});

describe('MireModelBuilder: aggregation, coverage, and counters', () => {
	it('aggregates the coding agents and the subagents of each tab, workspace, and Heidrun', () => {
		const model = MireModelBuilder.build(fixtures.input({
			workspaces: [fixtures.workspace('w1', 1, 'one'), fixtures.workspace('w2', 2, 'two')],
			tabs: [
				fixtures.tab('w1:t1', 'w1', 1, 'A'),
				fixtures.tab('w1:t2', 'w1', 2, 'B'),
				fixtures.tab('w2:t1', 'w2', 1, 'C'),
			],
			panes: [
				fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
					agent: 'claude',
					agent_status: 'done',
				}),
				fixtures.pane('w1:p2', 'term_b', 'w1:t2', {
					agent: 'claude',
					agent_status: 'idle',
					tokens: {
						hd_sid: 's1',
					},
				}),
				fixtures.pane('w2:p1', 'term_c', 'w2:t1', {
					agent: 'antigravity',
					agent_status: 'unknown',
				}),
			],
			observations: fixtures.observations({
				sessions: [fixtures.claudeSession('s1', {
					subagents: [fixtures.claudeSubagent('a1')],
				})],
			}),
		}));
		const [first, second] = model.workspaces;
		expect(first.tabs.map((tab) => tab.status)).toEqual(['finished', 'working']);
		expect(first.status).toBe('working');
		expect(second.status).toBe('unknown');
		expect(second.coverage).toEqual({
			total: 1,
			unknown: 1,
			stale: 0,
			unmatched: 0,
			notObserved: 1,
		});
		expect(model.status).toBe('working');
		expect(model.counters.codingAgents).toEqual({
			working: 0,
			blocked: 0,
			finished: 1,
			idle: 1,
			unknown: 1,
			total: 3,
		});
		expect(model.counters.subagents.working).toBe(1);
	});
});

describe('MireModelBuilder: task texts', () => {
	it('labels the initial instructions and the last prompt as such, and never as the current task', () => {
		const model = MireModelBuilder.build(fixtures.input({
			...FRAME,
			panes: [fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
				agent: 'claude',
				tokens: {
					hd_sid: 's1',
				},
			})],
			observations: fixtures.observations({
				sessions: [fixtures.claudeSession('s1', {
					subagents: [fixtures.claudeSubagent('a1', {
						initialInstructions: 'Read the tests.',
						startedAtMs: NOW_MS - 100,
					})],
					messages: [
						fixtures.message('m1', 's1', 'a1', {
							text: 'Now fix them.',
							atMs: NOW_MS - 50,
						}),
						fixtures.message('m2', 's1', 'a1', {
							text: 'Older text.',
							atMs: NOW_MS - 80,
						}),
					],
				})],
			}),
		}));
		expect(codingAgents(model)[0].subagents[0].taskTexts).toEqual([
			{
				label: 'initial_instructions',
				text: 'Read the tests.',
				atMs: NOW_MS - 100,
			},
			{
				label: 'last_prompt',
				text: 'Now fix them.',
				atMs: NOW_MS - 50,
			},
		]);
		expect(JSON.stringify(model)).not.toMatch(/current_?task/i);
	});
});

describe('Mire folder', () => {
	it('never reads the data layer table subagents, which holds configuration files', () => {
		const folder = import.meta.dirname;
		for (const file of readdirSync(folder).filter((name) => name.endsWith('.ts') && name.endsWith('.test.ts') === false)) {
			const source = readFileSync(join(folder, file), 'utf8');
			expect(source, file).not.toMatch(/data_layer|from\s+subagents|subagents\s+where/i);
		}
	});
});
