import { describe, expect, it } from 'vitest';
import type { LaunchersAnswer } from '../src/mobile_types';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';

const launchersAnswer = (): LaunchersAnswer => ({
	workspaces: [
		{
			id: 'w-1',
			label: 'heidrun',
			error: null,
			launchers: [
				{
					id: 'dev',
					label: 'Dev server',
					description: 'Starts Heidrun Code',
					command: 'pnpm dev',
					status: 'running',
				},
				{
					id: 'clean',
					label: 'Clean',
					description: null,
					command: 'rm -rf build',
					status: 'idle',
				},
			],
		},
	],
});

const computerWithLaunchers = () => {
	const computer = Fixtures.computer();
	computer.launchersAnswer = launchersAnswer();
	return computer;
};

describe('Launchers screen', () => {
	it('lists the launchers of each workspace, with their status, and the command when there is no description', async () => {
		const harness = await AppHarness.start(computerWithLaunchers(), true, '#/launchers');
		expect(document.querySelector('header h1')?.textContent).toBe('Launchers');
		expect(document.querySelector('.eyebrow')?.textContent).toBe('heidrun');
		const names = [...document.querySelectorAll('.launcher .name')].map((name) => name.textContent);
		expect(names).toEqual(['Dev server', 'Clean']);
		const badges = [...document.querySelectorAll('.launcher .badge')].map((badge) => badge.textContent);
		expect(badges).toEqual(['Running', 'Not started']);
		expect(harness.text()).toContain('Starts Heidrun Code');
		expect(document.querySelector('.launcher .detail')?.textContent).toBe('rm -rf build');
	});

	it('shows Stop for a running launcher, and Run for the others', async () => {
		await AppHarness.start(computerWithLaunchers(), true, '#/launchers');
		expect(document.querySelector('[data-action="stop-launcher"]')?.getAttribute('data-launcher-id')).toBe('dev');
		expect(document.querySelector('[data-action="run-launcher"]')?.getAttribute('data-launcher-id')).toBe('clean');
	});

	it('says that there is no launcher when no project has one', async () => {
		const harness = await AppHarness.start(Fixtures.computer(), true, '#/launchers');
		expect(harness.text()).toContain('No launcher.');
	});

	it('shows the error of a project file that cannot be read', async () => {
		const computer = Fixtures.computer();
		computer.launchersAnswer = {
			workspaces: [
				{
					id: 'w-1',
					label: 'heidrun',
					error: 'Invalid .heidrun/config.json',
					launchers: [],
				},
			],
		};
		const harness = await AppHarness.start(computer, true, '#/launchers');
		expect(harness.text()).toContain('Invalid .heidrun/config.json');
	});

	it('runs a launcher, after the check of a dangerous command', async () => {
		const computer = computerWithLaunchers();
		computer.answers.launch = [
			{
				confirm: {
					command: 'rm -rf build',
					why: 'deletes files',
				},
			},
			{
				ok: true,
			},
		];
		const harness = await AppHarness.start(computer, true, '#/launchers');
		await harness.tap('[data-action="run-launcher"]');
		expect(harness.overlay.querySelector('.sheet')?.textContent).toContain('rm -rf build');
		await harness.tap('[data-action="sheet-confirm"]');
		expect(computer.callsOf('launch').map((call) => call.params)).toEqual([
			{
				workspaceId: 'w-1',
				launcherId: 'clean',
				action: 'run',
			},
			{
				workspaceId: 'w-1',
				launcherId: 'clean',
				action: 'run',
				confirmed: true,
				command: 'rm -rf build',
			},
		]);
		expect(harness.toast()).toBe('Launcher started');
	});

	it('stops a running launcher', async () => {
		const computer = computerWithLaunchers();
		const harness = await AppHarness.start(computer, true, '#/launchers');
		await harness.tap('[data-action="stop-launcher"]');
		expect(computer.callsOf('launch').pop()?.params).toEqual({
			workspaceId: 'w-1',
			launcherId: 'dev',
			action: 'stop',
		});
		expect(harness.toast()).toBe('Launcher stopped (Ctrl+C)');
	});
});
