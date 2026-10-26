///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DesignRules — checks shared appearances and measures readable color pairs
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Source checks used by the normal development tests. */
export class DesignRules {
	/**
	 * Detects local palette and shared button or status overrides.
	 * @param source - Application source text.
	 * @param isVue - Whether only Vue style blocks should be inspected.
	 * @returns Rule violations with the correction to apply.
	 */
	static violations(source: string, isVue: boolean): string[] {
		const styles = isVue
			? [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join('\n')
			: source;
		const clean = styles.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
		const violations: string[] = [];
		const patterns = [
			/#[\da-f]{3,8}\b/.source,
			/\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(\s*[\d.]+/.source,
			/(?:color|background(?:-color)?|border-color):\s*(?:white|black|red|green|blue|gray|grey|orange|purple)\b/.source,
		];
		const literal = new RegExp(patterns.join('|'), 'gi');
		for (const match of clean.matchAll(literal)) {
			violations.push(`Local color ${match[0]}: use a purpose variable from styles.css (issue 749).`);
		}
		for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
			const selector = match[1].trim();
			const declarations = match[2];
			if (/\.dot(?:[.\s:#\[]|$)|\.t-(?:working|blocked|done|idle|unknown|question)\b/.test(selector)) {
				violations.push(`${selector}: status appearances belong to styles.css and status_dot.md (issue 739).`);
			}
			if (/\.btn(?:[.:\s\[]|$)/.test(selector)
				&& /(?:--btn-(?:color|bg|hover|active|disabled)|(?:^|;)\s*(?:background(?:-color)?|color|opacity)\s*:)/
					.test(declarations)
				&& /\.is-(?:recording|waiting|transcribing)\b/.test(selector) === false
				&& selector !== '.sel-bar .btn') {
				violations.push(`${selector}: button appearance belongs to styles.css; keep only layout here (issue 749).`);
			}
		}
		return violations;
	}

	/**
	 * Reads the effective variables of one theme, including inherited dark values.
	 * @param source - The authoritative stylesheet.
	 * @param isLight - Whether to include the light theme overrides.
	 * @returns Variable values keyed by their names without the leading dashes.
	 */
	static palette(source: string, isLight: boolean): Record<string, string> {
		const dark = source.match(/:root\s*\{([^}]+)\}/)?.[1] ?? '';
		const light = source.match(/:root\[data-theme="light"\]\s*\{([^}]+)\}/)?.[1] ?? '';
		return Object.fromEntries(
			[...(dark + (isLight ? light : '')).matchAll(/--([\w-]+):\s*([^;]+);/g)]
				.map((match) => [match[1], match[2].trim()]),
		);
	}

	/**
	 * Measures contrast using relative luminance for opaque sRGB colors.
	 * @param foreground - Foreground as a six digit hexadecimal color.
	 * @param background - Background as a six digit hexadecimal color.
	 * @returns The contrast ratio between 1 and 21.
	 */
	static contrast(foreground: string, background: string): number {
		const first = DesignRules._luminance(foreground);
		const second = DesignRules._luminance(background);
		return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
	}

	/**
	 * Calculates relative luminance.
	 * @param color - An opaque hexadecimal color.
	 * @returns Relative luminance.
	 */
	private static _luminance(color: string): number {
		if (/^#[\da-f]{6}$/i.test(color) === false) {
			throw new Error(`Expected an opaque six digit hexadecimal color, received ${color}`);
		}
		const channels = [1, 3, 5].map((offset) => {
			const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
			return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		});
		return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
	}
}
