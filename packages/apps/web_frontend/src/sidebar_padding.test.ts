// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SidebarPaddingTest — the padding of the two sidebars and of their sidebar sections
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the padding of the left sidebar and of the right sidebar.
 */
class SidebarPaddingTestHelper {
	/**
	 * Reads the text of one style rule of a Vue component.
	 *
	 * @param componentPath The path of the Vue component, relative to the folder `src`.
	 * @param selector The selector of the style rule, for example `.side`.
	 * @returns The text of the style rule, from the selector to the closing brace.
	 */
	static readRule(componentPath: string, selector: string): string {
		const componentText = Fs.readFileSync(Path.resolve(__dirname, componentPath), 'utf8');
		const styleText = componentText.slice(componentText.indexOf('<style'));
		const ruleStart = styleText.indexOf(`\n${selector} {`);
		if (ruleStart === -1) {
			throw new Error(`The style rule ${selector} is missing in ${componentPath}.`);
		}
		return styleText.slice(ruleStart, styleText.indexOf('}', ruleStart));
	}

	/**
	 * Reads the value of one declaration in one style rule of a Vue component.
	 *
	 * @param componentPath The path of the Vue component, relative to the folder `src`.
	 * @param selector The selector of the style rule, for example `.side`.
	 * @param property The name of the declaration, for example `padding`.
	 * @returns The value of the declaration, for example `5px 0 16px`.
	 */
	static readDeclaration(componentPath: string, selector: string, property: string): string {
		const ruleText = SidebarPaddingTestHelper.readRule(componentPath, selector);
		const match = new RegExp(`[\\s;{]${property}:\\s*([^;]+);`).exec(ruleText);
		if (match === null) {
			throw new Error(`The declaration ${property} is missing in the style rule ${selector} of ${componentPath}.`);
		}
		return match[1].trim();
	}
}

describe('padding of the left sidebar', () => {
	it('has no padding of its own, so the sidebar icon bar reaches the borders of the frame', () => {
		const rule = SidebarPaddingTestHelper.readRule('components/Sidebar.vue', '.side');
		expect(rule).not.toContain('padding');
	});

	it('leaves 5px at the top, 0 on the left and on the right, and 16px at the bottom of the content', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/Sidebar.vue', '.sidebar-section-body', 'padding');
		expect(padding).toBe('5px 0 16px');
	});
});

describe('horizontal padding of the sidebar sections of the left sidebar', () => {
	it('is 16px on each side for the Launchers sidebar section, as for the Source control sidebar section', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/LaunchersPanel.vue', '.panel', 'padding');
		expect(padding).toBe('12px 16px');
	});

	it('is 16px on each side for the Source control sidebar section', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/SourceControlPanel.vue', '.source-control', 'padding');
		expect(padding).toBe('12px 16px');
	});
});

describe('padding of the right sidebar', () => {
	it('has no padding of its own, so the sidebar icon bar reaches the borders of the frame', () => {
		const rule = SidebarPaddingTestHelper.readRule('components/RightPanel.vue', '.right');
		expect(rule).not.toContain('padding');
	});

	it('leaves 5px above the content, as the left sidebar does', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/RightPanel.vue', '.sidebar-section-body', 'padding-top');
		expect(padding).toBe('5px');
	});
});

describe('horizontal padding of the sidebar sections of the right sidebar', () => {
	it('is 6px on each side for the Needs you sidebar section, with 8px above and 16px below', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/ToHandlePanel.vue', '.to-handle', 'padding');
		expect(padding).toBe('8px 6px 16px');
	});

	it('is 14px on each side for the Clipboard sidebar section, with 12px above its title and 18px below', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/NotesPanel.vue', '.panel', 'padding');
		expect(padding).toBe('12px 14px 18px');
	});

	it('leaves the same space at the top and at the left of its title in the Needs you sidebar section, as in the Past chats sidebar section', () => {
		const needsYouPadding = SidebarPaddingTestHelper.readDeclaration('components/ToHandlePanel.vue', '.needs-you-title', 'padding');
		const pastChatsPadding = SidebarPaddingTestHelper.readDeclaration('components/ChatsPanel.vue', '.past-chats-title', 'padding');
		const pastChatsInset = SidebarPaddingTestHelper.readDeclaration('components/ChatsPanel.vue', '.past-chats', '--chats-inset');
		expect(needsYouPadding).toBe('12px 14px 0');
		expect(pastChatsPadding).toBe('12px var(--chats-inset) 0');
		expect(pastChatsInset).toBe('14px');
	});
});
