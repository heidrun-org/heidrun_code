import { describe, expect, it } from 'vitest';
import type { GameCommand } from 'git_runner';
import { DinoRunRecorder } from '../src/dino_run_recorder.ts';

describe('DinoRunRecorder', () => {
	const commands: GameCommand[] = ['start', 'pause', 'jump', 'laneUp', 'laneDown', 'shoot'];

	it('gives a different key to each command', () => {
		const keys = commands.map((command) => DinoRunRecorder.keyOf(command));
		expect(new Set(keys).size).toBe(commands.length);
	});

	it('starts the run with the key Enter, as the page does', () => {
		expect(DinoRunRecorder.keyOf('start')).toBe('Enter');
	});
});
