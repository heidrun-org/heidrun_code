// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ControlStylesTest — prevents application controls from bypassing the shared design
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const __dirname = import.meta.dirname;
const componentsPath = Path.resolve(__dirname, '../components');

/** Inspects all application controls rather than relying on the design gallery. */
class ControlStylesTest {
	/**
	 * Finds every Vue component.
	 * @param directory - Component directory.
	 * @returns Component source paths.
	 */
	static files(directory: string): string[] {
		return Fs.readdirSync(directory, {
			withFileTypes: true,
		}).flatMap((entry) => {
			const path = Path.join(directory, entry.name);
			if (entry.isDirectory()) {
				return ControlStylesTest.files(path);
			}
			return path.endsWith('.vue') ? [path] : [];
		});
	}

	/**
	 * Finds controls that do not consume an approved shared treatment.
	 * @param source - Complete Vue component or a template used by a negative test.
	 * @param name - Component name for the caller-supplied menu button exception.
	 * @returns Explanations of missing control treatments.
	 */
	static violations(source: string, name: string): string[] {
		const start = source.indexOf('<template>');
		const end = source.lastIndexOf('</template>');
		const template = start >= 0 ? source.slice(start + 10, end) : source;
		const tags = /<(button|input|textarea|select)\b(?:[^"'>]|"[^"]*"|'[^']*')*>/g;
		const violations: string[] = [];
		for (const match of template.matchAll(tags)) {
			const tag = match[0];
			const classes = tag.match(/(?<![:\w-])class="([^"]*)"/)?.[1].split(/\s+/) ?? [];
			if (match[1] === 'button') {
				const shared = ['btn', 'menu-item', 'navigation-action', 'list-action', 'list-group-item-action'];
				const hasTreatment = shared.some((value) => classes.includes(value));
				const isRuntimeButton = /:class="\['btn\s/.test(tag)
					|| name === 'SourceControlMenu.vue' && tag.includes('props.buttonClass');
				// External label colors and image content have their own documented rendering constraints.
				const isContent = classes.includes('badge')
					|| name === 'CompositionBar.vue' && classes.includes('open');
				if (hasTreatment === false && isRuntimeButton === false && isContent === false) {
					violations.push(`${name}: ${tag.split('\n')[0]} needs a shared button, menu, row, or navigation class.`);
				}
			} else if (/type="(?:checkbox|radio|file|hidden|range|color)"/.test(tag) === false
				&& classes.includes('form-control') === false) {
				violations.push(`${name}: ${tag.split('\n')[0]} needs form-control.`);
			}
		}
		return violations;
	}
}

describe('the shared styles in the complete application (issue 749)', () => {
	it('rejects a custom action or text field without the shared treatment', () => {
		expect(ControlStylesTest.violations('<button class="own-action">Save</button>', 'example.vue'))
			.toHaveLength(1);
		expect(ControlStylesTest.violations('<input class="own-field">', 'example.vue')).toHaveLength(1);
		expect(ControlStylesTest.violations('<button class="btn primary">Save</button>', 'example.vue')).toEqual([]);
		expect(ControlStylesTest.violations('<input type="checkbox">', 'example.vue')).toEqual([]);
	});

	it('uses shared treatments for every application button and text field', () => {
		const violations = ControlStylesTest.files(componentsPath).flatMap((path) =>
			ControlStylesTest.violations(Fs.readFileSync(path, 'utf8'), Path.basename(path)),
		);
		expect(violations).toEqual([]);
	});

	it('gives a selected list row the text color of the main action, because the rule of plain buttons has no layer', () => {
		const styles = Fs.readFileSync(Path.resolve(__dirname, '../styles.css'), 'utf8');
		expect(styles).toMatch(/\n\.list-group-item\.active \{ color: var\(--list-group-active-color\); \}\n/);
	});
});
