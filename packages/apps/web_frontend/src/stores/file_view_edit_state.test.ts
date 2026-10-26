import { beforeEach, describe, expect, it, vi } from 'vitest';

const askConfirmMock = vi.hoisted(() => vi.fn(async (_title: string, _confirmLabel: string) => true));
vi.mock('./confirm', () => ({ askConfirm: askConfirmMock }));

import { fileViewEdits, FileViewEditState, type FileViewEdit } from './file_view_edit_state';

function editOf(path: string, original: string, current: string): FileViewEdit {
	return {
		root: '/work/project',
		path,
		original,
		hash: 'hash',
		current,
		isConflict: false,
		diskText: null,
		diskHash: null,
		isSaving: false,
	};
}

beforeEach(() => {
	askConfirmMock.mockReset();
	askConfirmMock.mockResolvedValue(true);
	for (const paneId of Object.keys(fileViewEdits)) {
		delete fileViewEdits[paneId];
	}
	fileViewEdits['w1:p2'] = editOf('src/a.ts', 'a', 'a changed');
	fileViewEdits['w1:p3'] = editOf('src/b.ts', 'b', 'b');
});

describe('FileViewEditState (issue #899)', () => {
	it('tells which panes have unsaved changes', () => {
		expect(FileViewEditState.isDirty('w1:p2')).toBe(true);
		expect(FileViewEditState.isDirty('w1:p3')).toBe(false);
		expect(FileViewEditState.isDirty('w1:p9')).toBe(false);
		expect(FileViewEditState.dirtyPaneIds()).toEqual(['w1:p2']);
	});

	it('asks nothing before panes without unsaved changes close', async () => {
		expect(await FileViewEditState.confirmDiscard(['w1:p3', 'w1:p9'])).toBe(true);
		expect(askConfirmMock).not.toHaveBeenCalled();
	});

	it('names the files with unsaved changes, and keeps them when the developer cancels', async () => {
		askConfirmMock.mockResolvedValue(false);
		expect(await FileViewEditState.confirmDiscard(['w1:p2', 'w1:p3'])).toBe(false);
		expect(askConfirmMock).toHaveBeenCalledWith('1 file has unsaved changes: a.ts. Close without saving?', 'Close without saving');
		expect(FileViewEditState.isDirty('w1:p2')).toBe(true);
	});

	it('drops the changes when the developer closes without saving', async () => {
		expect(await FileViewEditState.confirmDiscard(['w1:p2'])).toBe(true);
		expect(fileViewEdits['w1:p2']).toBeUndefined();
	});
});
