import { beforeEach, describe, expect, it, vi } from 'vitest';

const panes = vi.hoisted(() => ({ value: [] as Record<string, unknown>[] }));
const insertTextMock = vi.hoisted(() => vi.fn(async () => {}));
const selectPaneMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const history = vi.hoisted(() => ({ paneIds: [] as string[] }));

vi.mock('./session', () => ({ allPanes: panes, insertText: insertTextMock, selectPane: selectPaneMock, toast: toastMock }));
vi.mock('./pane_focus_history_state', () => ({ paneFocusHistory: history }));

import { FileViewAgentPrompt } from './file_view_agent_prompt';
import type { AgentInfo } from '../lib/types';

const FILE_PANE = { pane_id: 'w1:p9', tab_id: 'w1:t1', workspace_id: 'w1', label: 'Heidrun file view: /work/project/src/a.ts' } as AgentInfo;
const SELECTED_LINES = { path: 'src/a.ts', fromLine: 3, toLine: 4, text: 'const a = 1;\nconst b = 2;\n' };

beforeEach(() => {
	insertTextMock.mockClear();
	selectPaneMock.mockClear();
	toastMock.mockClear();
	history.paneIds = [];
	panes.value = [
		FILE_PANE as unknown as Record<string, unknown>,
		{ pane_id: 'w1:p1', tab_id: 'w1:t1', agent: 'claude' },
		{ pane_id: 'w1:p2', tab_id: 'w1:t1', agent: null },
		{ pane_id: 'w1:p3', tab_id: 'w1:t1', agent: 'codex' },
		{ pane_id: 'w1:p4', tab_id: 'w1:t2', agent: 'claude' },
	];
});

describe('FileViewAgentPrompt (issue #901)', () => {
	it('chooses the coding agent of the tab that had the keyboard last', () => {
		history.paneIds = ['w1:p3', 'w1:p4', 'w1:p1', 'w1:p2', 'w1:p9'];
		expect(FileViewAgentPrompt.targetPane(FILE_PANE)?.pane_id).toBe('w1:p1');
	});

	it('chooses the first coding agent of the tab when none had the keyboard, and never a coding agent of another tab', () => {
		history.paneIds = ['w1:p4'];
		expect(FileViewAgentPrompt.targetPane(FILE_PANE)?.pane_id).toBe('w1:p1');
	});

	it('writes the path, the lines, the code, and the request, without pressing Enter, and selects the coding agent', async () => {
		expect(await FileViewAgentPrompt.ask(FILE_PANE, SELECTED_LINES, 'fix')).toBe(true);
		expect(insertTextMock).toHaveBeenCalledWith(
			'w1:p1',
			'In @src/a.ts (lines 3-4):\n\n```typescript\nconst a = 1;\nconst b = 2;\n```\n\nFix these lines (explain what was wrong).',
			false,
		);
		expect(selectPaneMock).toHaveBeenCalledWith(panes.value[1]);
	});

	it('writes one line as "line N", with the request to explain', () => {
		expect(FileViewAgentPrompt.prompt({ ...SELECTED_LINES, toLine: 3, text: 'x' }, 'explain')).toBe(
			'In @src/a.ts (line 3):\n\n```typescript\nx\n```\n\nExplain this code to me.',
		);
	});

	it('writes nothing and says why when the tab has no coding agent', async () => {
		panes.value = [FILE_PANE as unknown as Record<string, unknown>, { pane_id: 'w1:p2', tab_id: 'w1:t1', agent: null }];
		expect(await FileViewAgentPrompt.ask(FILE_PANE, SELECTED_LINES, 'explain')).toBe(false);
		expect(insertTextMock).not.toHaveBeenCalled();
		expect(toastMock).toHaveBeenCalledWith('This tab has no coding agent: open a coding agent in this tab first', 'error');
	});
});
