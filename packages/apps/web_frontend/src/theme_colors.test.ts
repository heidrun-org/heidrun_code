// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ThemeColorsTest — the window retains the VS Code base palette with readable secondary text
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the theme colors.
 */
class ThemeColorsTestHelper {
	/**
	 * Reads a source file of the web frontend.
	 *
	 * @param relativePath - The path of the file, relative to the folder `src`.
	 * @returns The text of the file.
	 */
	static readSource(relativePath: string): string {
		return Fs.readFileSync(Path.resolve(__dirname, relativePath), 'utf8');
	}

	/**
	 * Cuts `styles.css` into the text of the dark theme and the text of the light theme.
	 *
	 * @returns The text of the rule `:root` (dark theme) and the text of the rule `:root[data-theme="light"]`.
	 */
	static readThemeTexts(): { darkText: string; lightText: string } {
		const stylesText = ThemeColorsTestHelper.readSource('styles.css');
		const lightStart = stylesText.indexOf(':root[data-theme="light"] {');
		return {
			darkText: stylesText.slice(0, lightStart),
			lightText: stylesText.slice(lightStart, stylesText.indexOf('}', lightStart)),
		};
	}

	/**
	 * Reads the value of a CSS variable in the text of one theme.
	 *
	 * @param themeText - The text of the dark theme or of the light theme.
	 * @param variableName - The name of the variable, for example `--bg`.
	 * @returns The value of the variable, or `null` when the theme does not define it.
	 */
	static readValue(themeText: string, variableName: string): string | null {
		const match = themeText.match(new RegExp(`^\\s*${variableName}:\\s*([^;]+);`, 'm'));
		if (match === null) {
			return null;
		}
		return match[1].trim();
	}

	/**
	 * Gives the contrast ratio of two colors, as the Web Content Accessibility Guidelines define it.
	 *
	 * @param firstColor - The first color, in the form `#rrggbb`.
	 * @param secondColor - The second color, in the form `#rrggbb`.
	 * @returns The contrast ratio, from 1 (the same color) to 21 (black and white).
	 */
	static contrastRatio(firstColor: string, secondColor: string): number {
		const firstLuminance = ThemeColorsTestHelper._relativeLuminance(firstColor);
		const secondLuminance = ThemeColorsTestHelper._relativeLuminance(secondColor);
		return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
	}

	/**
	 * Gives the relative luminance of a color.
	 *
	 * @param color - The color, in the form `#rrggbb`.
	 * @returns The relative luminance, from 0 (black) to 1 (white).
	 */
	static _relativeLuminance(color: string): number {
		const channels = [1, 3, 5].map((start) => {
			const value = parseInt(color.slice(start, start + 2), 16) / 255;
			return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
	}
}

describe('the theme colors', () => {
	const colorTable: Array<{ variableName: string; dark: string; light: string }> = [
		{ variableName: '--shell', dark: '#181818', light: '#f8f8f8' },
		{ variableName: '--side', dark: '#181818', light: '#f8f8f8' },
		{ variableName: '--bg', dark: '#1f1f1f', light: '#ffffff' },
		{ variableName: '--text', dark: '#cccccc', light: '#3b3b3b' },
		{ variableName: '--muted', dark: '#a0a0a0', light: '#656565' },
		{ variableName: '--line', dark: '#2b2b2b', light: '#e5e5e5' },
		{ variableName: '--icon', dark: '#888888', light: '#5d5d5d' },
	];

	for (const { variableName, dark, light } of colorTable) {
		it(`give ${variableName} its approved value in the dark theme and in the light theme`, () => {
			const { darkText, lightText } = ThemeColorsTestHelper.readThemeTexts();
			expect(ThemeColorsTestHelper.readValue(darkText, variableName)).toBe(dark);
			expect(ThemeColorsTestHelper.readValue(lightText, variableName)).toBe(light);
		});
	}

	it('give the caret of the code editor the text color in both themes', () => {
		const { darkText, lightText } = ThemeColorsTestHelper.readThemeTexts();
		expect(ThemeColorsTestHelper.readValue(darkText, '--editor-caret')).toBe(ThemeColorsTestHelper.readValue(darkText, '--text'));
		expect(ThemeColorsTestHelper.readValue(lightText, '--editor-caret')).toBe(ThemeColorsTestHelper.readValue(lightText, '--text'));
	});

	it('give the terminal themes the same background as a pane (--bg), in both themes', () => {
		const { darkText, lightText } = ThemeColorsTestHelper.readThemeTexts();
		const terminalText = ThemeColorsTestHelper.readSource('lib/terminal_themes.ts');
		const darkBackground = terminalText.match(/dark:\s*\{\s*background:\s*"(#[0-9a-f]{6})"/i);
		const lightBackground = terminalText.match(/light:\s*\{\s*background:\s*"(#[0-9a-f]{6})"/i);
		expect(darkBackground?.[1]).toBe(ThemeColorsTestHelper.readValue(darkText, '--bg'));
		expect(lightBackground?.[1]).toBe(ThemeColorsTestHelper.readValue(lightText, '--bg'));
	});

	it('draw the icons of the sidebar icon bars with --icon, and the selected icon with --text', () => {
		const iconBarText = ThemeColorsTestHelper.readSource('components/SidebarIconBar.vue');
		expect(iconBarText).toMatch(/\.sidebar-icon-bar button \{[^}]*color: var\(--icon\);/);
		expect(iconBarText).toMatch(/\.icons button\.on \{[^}]*color: var\(--text\);/);
	});

	it('give the hovered menu item a background that stands out from the menu, in both themes (issue #964)', () => {
		const { darkText, lightText } = ThemeColorsTestHelper.readThemeTexts();
		const stylesText = ThemeColorsTestHelper.readSource('styles.css');
		expect(stylesText).toMatch(/\.menu-item \{[^}]*--menu-item-hover-bg: var\(--menu-hover\);/);
		for (const themeText of [darkText, lightText]) {
			const menuColor = ThemeColorsTestHelper.readValue(themeText, '--raised') ?? '';
			const hoverColor = ThemeColorsTestHelper.readValue(themeText, '--menu-hover') ?? '';
			expect(ThemeColorsTestHelper.contrastRatio(menuColor, hoverColor)).toBeGreaterThanOrEqual(1.3);
		}
	});
});
