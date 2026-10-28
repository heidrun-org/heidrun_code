// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;
const desktopStyles = Fs.readFileSync(Path.join(__dirname, 'styles.css'), 'utf8');
const mobileStyles = Fs.readFileSync(
	Path.resolve(__dirname, '../../../auxiliary/mobile_website/src/style.css'), 'utf8',
);
const statusItemSource = Fs.readFileSync(
	Path.resolve(__dirname, '../../desktop_tauri/src/status_item.rs'), 'utf8',
);

/** Reads the shared colors and indicator rules across the desktop and mobile website. */
class StatusIndicatorsTest {
	/**
	 * Reads one color from a theme declaration.
	 * @param styles - The stylesheet or theme declaration.
	 * @param status - The status whose color is read.
	 * @returns The hexadecimal color value.
	 */
	static color(styles: string, status: string): string | undefined {
		return styles.match(new RegExp(`--${status}: (#[a-f0-9]{6});`))?.[1];
	}

	/**
	 * Reads one complete style rule.
	 * @param styles - The stylesheet.
	 * @param selector - The selector whose declarations are read.
	 * @returns The declarations of the selector.
	 */
	static rule(styles: string, selector: string): string {
		const start = styles.indexOf(`${selector} {`);
		expect(start, selector).toBeGreaterThanOrEqual(0);
		return styles.slice(start, styles.indexOf('}', start) + 1);
	}
}

describe('shared status indicators (issue 739)', () => {
	it('uses the macOS status item colors on the desktop and mobile website in the dark theme', () => {
		for (const status of ['blocked', 'working', 'done']) {
			const match = statusItemSource.match(new RegExp(`${status.toUpperCase()}_COLOR:.*?= \\[(\\d+), (\\d+), (\\d+)\\]`));
			expect(match).not.toBeNull();
			const color = `#${match?.slice(1).map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`;
			expect(StatusIndicatorsTest.color(desktopStyles, status)).toBe(color);
			expect(StatusIndicatorsTest.color(mobileStyles, status)).toBe(color);
		}
		expect(StatusIndicatorsTest.color(mobileStyles, 'idle')).toBe(StatusIndicatorsTest.color(desktopStyles, 'idle'));
	});

	it('defines a distinct status color in both desktop themes', () => {
		const lightStart = desktopStyles.indexOf(':root[data-theme="light"] {');
		const themes = [desktopStyles.slice(0, lightStart), desktopStyles.slice(lightStart)];
		for (const theme of themes) {
			const colors = ['blocked', 'working', 'done', 'idle'].map((status) => StatusIndicatorsTest.color(theme, status));
			expect(colors.every((color) => color !== undefined)).toBe(true);
			expect(new Set(colors).size).toBe(4);
		}
	});

	it('uses the same empty spinning ring for Working on the desktop and mobile website', () => {
		const rules = [
			StatusIndicatorsTest.rule(desktopStyles, '.dot.working'),
			StatusIndicatorsTest.rule(mobileStyles, '.dot-working'),
		];
		for (const rule of rules) {
			expect(rule).toContain('background: transparent;');
			expect(rule).toContain('border: 1.5px solid var(--working);');
			expect(rule).toContain('border-right-color: transparent;');
			expect(rule).toContain('animation: status-spin 0.8s linear infinite;');
		}
		for (const styles of [desktopStyles, mobileStyles]) {
			expect(styles).toContain('to { transform: rotate(360deg); }');
		}
	});

	it('keeps the other status dots static and removes the former pulse and fade animations', () => {
		for (const status of ['blocked', 'done']) {
			expect(StatusIndicatorsTest.rule(desktopStyles, `.dot.${status}`)).not.toContain('animation:');
			expect(StatusIndicatorsTest.rule(mobileStyles, `.dot-${status}`)).not.toContain('animation:');
		}
		expect(StatusIndicatorsTest.rule(desktopStyles, '.dot')).not.toContain('animation:');
		expect(StatusIndicatorsTest.rule(mobileStyles, '.dot-idle')).not.toContain('animation:');
		expect(desktopStyles).not.toMatch(/breathe|pulse-once|\.dot\.pulse/);
	});
});
