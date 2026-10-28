// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DesignRules } from './design_rules';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DesignRulesTest — enforces the shared visual rules against real application sources
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const __dirname = import.meta.dirname;
const sourcePath = Path.resolve(__dirname, '..');
const styles = Fs.readFileSync(Path.join(sourcePath, 'styles.css'), 'utf8');

/** Lists application styles while excluding test fixtures. */
class DesignRulesTest {
	/**
	 * Recursively finds source files.
	 * @param directory - Source directory.
	 * @returns Paths of application scripts, stylesheets, and Vue components.
	 */
	static files(directory: string): string[] {
		return Fs.readdirSync(directory, {
			withFileTypes: true,
		}).flatMap((entry) => {
			const path = Path.join(directory, entry.name);
			if (entry.isDirectory()) {
				return DesignRulesTest.files(path);
			}
			return /\.(vue|css|ts|scss)$/.test(path) && path.includes('.test.') === false ? [path] : [];
		});
	}
}

describe('shared design rules (issue 749)', () => {
	it('rejects local literals and duplicated button or status appearances', () => {
		expect(DesignRules.violations('.local { color: #fff; }', false)).toHaveLength(1);
		expect(DesignRules.violations('.local { color: red; }', false)).toHaveLength(1);
		expect(DesignRules.violations('.local { color: rgb(255, 0, 0); }', false)).toHaveLength(1);
		expect(DesignRules.violations('.btn.primary { background: var(--accent); }', false)).toHaveLength(1);
		expect(DesignRules.violations('.dot.working { background: var(--done); }', false)).toHaveLength(1);
		expect(DesignRules.violations('/* #749 */ .local { color: var(--text); }', false)).toEqual([]);
		expect(DesignRules.violations('<template>#123</template><style>.local { color: #fff; }</style>', true))
			.toHaveLength(1);
		expect(DesignRules.violations('<style>.first { color: var(--text); }</style>'
			+ '<style>.second { color: #fff; }</style>', true)).toHaveLength(1);
	});

	it('uses purpose variables throughout application component styles', () => {
		const violations = DesignRulesTest.files(sourcePath)
			.filter((path) => /\.(vue|css|scss)$/.test(path) && path.endsWith('/styles.css') === false)
			.flatMap((path) => DesignRules.violations(Fs.readFileSync(path, 'utf8'), path.endsWith('.vue'))
				.filter((message) => path.endsWith('/bootstrap_parts.scss') === false || message.startsWith('Local color'))
				.map((message) => `${Path.relative(sourcePath, path)}: ${message}`));
		expect(violations).toEqual([]);
	});

	it('keeps literal runtime colors confined to specialized content renderers', () => {
		// These renderers need resolved strings; shared_design_inventory.md explains each exception.
		const contentPalettes = new Set([
			'design/theme_palette.ts',
			'lib/terminal_themes.ts',
			'lib/refs.ts',
		]);
		const exceptions: Record<string, string[]> = {
			'components/TerminalView.vue': ['#0b5cc2', '#7d4cc4', '#0e7c78', '#9a5b13'],
			'components/RcModal.vue': ['#0b0c0e', '#ffffff'],
			'components/StackedBarChart.vue': ['rgba(0, 0, 0, 0)'],
			'components/UserActivityHistogram.vue': ['rgba(0, 0, 0, 0)'],
		};
		const violations: string[] = [];
		for (const path of DesignRulesTest.files(sourcePath)) {
			const relative = Path.relative(sourcePath, path);
			if (contentPalettes.has(relative) || /\.(css|scss)$/.test(path)) {
				continue;
			}
			const source = Fs.readFileSync(path, 'utf8')
				.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*|<style[\s\S]*?<\/style>/gm, '');
			for (const match of source.matchAll(/['"](#[\da-f]{3,8}|rgba?\(\d[^'"]*\))['"]/gi)) {
				if ((exceptions[relative] ?? []).includes(match[1]) === false) {
					violations.push(`${relative}: local color ${match[1]}; use styles.css or document a renderer exception.`);
				}
			}
		}
		expect(violations).toEqual([]);
	});

	it('keeps literal shared colors inside palette declarations and code content themes', () => {
		const appearances = styles.replace(/:root(?:\[data-theme="light"\])?\s*\{[^}]*\}/g, '')
			.replace(/\.code(?:\.github-light)?\s*\{[^}]*\}/g, '');
		const literals = appearances.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[\da-f]{3,8}\b|rgba?\(\s*\d/gi);
		expect(literals).toBeNull();
	});

	it('maps every Bootstrap theme used by the application to the authoritative palette', () => {
		const names = new Set(DesignRulesTest.files(sourcePath).filter((path) => path.endsWith('.vue'))
			.flatMap((path) => [...Fs.readFileSync(path, 'utf8')
				.matchAll(/\btheme-(?!bg\b|fg\b|border\b)([a-z]+)\b/g)].map((match) => match[1])));
		for (const name of names) {
			for (const role of ['base', 'bg', 'fg', 'fg-emphasis', 'bg-subtle', 'bg-muted',
				'contrast', 'border', 'focus-ring']) {
				expect(styles, `${name}/${role}`).toMatch(new RegExp(`--${name}-${role}: var\\(--[\\w-]+\\);`));
			}
		}
	});

	it('measures contrast against known black and white values', () => {
		expect(DesignRules.contrast('#000000', '#ffffff')).toBe(21);
		expect(DesignRules.contrast('#ffffff', '#ffffff')).toBe(1);
		expect(DesignRules.contrast('#777777', '#ffffff')).toBeLessThan(4.5);
		expect(DesignRules.contrast('#767676', '#ffffff')).toBeGreaterThan(4.5);
		expect(() => DesignRules.contrast('unknown', '#ffffff')).toThrow();
	});

	for (const isLight of [false, true]) {
		const theme = isLight ? 'light' : 'dark';
		const palette = DesignRules.palette(styles, isLight);
		it(`keeps text readable on application surfaces in the ${theme} theme`, () => {
			for (const foreground of ['text', 'text-2', 'muted', 'muted-2', 'link', 'accent',
				'working-text', 'blocked-text', 'done-text']) {
				for (const background of ['bg', 'panel', 'shell', 'field', 'hover', 'raised', 'sel',
					'pane-head-selected', 'tint-err', 'tint-crit', 'tint-warn', 'tint-done', 'tint-working']) {
					const contrast = DesignRules.contrast(palette[foreground], palette[background]);
					expect(contrast, `${theme}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
				}
			}
		});

		it(`shows the hover of an icon button on a menu in the ${theme} theme`, () => {
			expect(DesignRules.contrast(palette['line-strong'], palette['raised']), `${theme}: line-strong on raised`)
				.toBeGreaterThanOrEqual(1.15);
			expect(styles).toMatch(/\.menu \.btn\.icon:not\(:active\) \{ --btn-hover-bg: var\(--line-strong\); \}/);
		});

		it(`keeps action labels and control boundaries visible in the ${theme} theme`, () => {
			for (const background of ['action-bg', 'action-hover', 'action-pressed']) {
				expect(DesignRules.contrast(palette['action-text'], palette[background]), background)
					.toBeGreaterThanOrEqual(4.5);
			}
			for (const background of ['danger-action-bg', 'danger-action-hover', 'danger-action-pressed',
				'reference-open', 'reference-merged', 'reference-closed']) {
				expect(DesignRules.contrast(palette['on-solid'], palette[background]), background)
					.toBeGreaterThanOrEqual(4.5);
			}
			for (const foreground of ['focus', 'control-border']) {
				for (const background of ['bg', 'panel', 'shell', 'field', 'hover']) {
					expect(DesignRules.contrast(palette[foreground], palette[background]), `${foreground}/${background}`)
						.toBeGreaterThanOrEqual(3);
				}
			}
		});
	}
});
