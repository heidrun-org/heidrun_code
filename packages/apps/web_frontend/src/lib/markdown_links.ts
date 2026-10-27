///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MarkdownLinks — finds what a link of a Markdown preview points to
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** What a link of a Markdown preview in a file view pane points to (issue #928). */
export type MarkdownLinkTarget =
	| {
			/** A web page, which opens in the browser. */
			kind: 'web';
			/** The address of the web page. */
			url: string;
	  }
	| {
			/** A heading of the file that the pane shows. */
			kind: 'heading';
			/** The anchor of the heading, without the sign `#`. */
			anchor: string;
	  }
	| {
			/** A file of the disk, which opens in the file view pane. */
			kind: 'file';
			/** The absolute path of the file. */
			absolutePath: string;
			/** The anchor after the sign `#`, or null when the link has no anchor. */
			anchor: string | null;
	  };

/** Finds what a link of a Markdown preview points to, and finds the heading of an anchor in the rendered text. */
export class MarkdownLinks {
	/**
	 * Finds what a link points to. A relative path starts at the folder of the Markdown file, and a path that starts with
	 * `/` starts at the root of the project, as on GitHub.
	 * @param href The address of the link, as the rendered text has it.
	 * @param absolutePath The absolute path of the Markdown file that holds the link.
	 * @param root The absolute path of the root of the project of the Markdown file.
	 * @returns The target of the link, or null for a link that Heidrun Code does not open (for example `mailto:`).
	 */
	static resolve(href: string, absolutePath: string, root: string): MarkdownLinkTarget | null {
		if (/^https?:\/\//i.test(href)) {
			return {
				kind: 'web',
				url: href,
			};
		}
		if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href === '') {
			return null;
		}
		const hashIndex = href.indexOf('#');
		const pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
		const anchorPart = hashIndex === -1 ? null : MarkdownLinks._decode(href.slice(hashIndex + 1));
		const anchor = anchorPart === '' ? null : anchorPart;
		const relativePath = MarkdownLinks._decode(pathPart.split('?')[0]);
		if (relativePath === '') {
			if (anchor === null) {
				return null;
			}
			return {
				kind: 'heading',
				anchor,
			};
		}
		const folder = relativePath.startsWith('/') ? root : absolutePath.slice(0, absolutePath.lastIndexOf('/'));
		return {
			kind: 'file',
			absolutePath: MarkdownLinks._normalize(`${folder}/${relativePath}`),
			anchor,
		};
	}

	/**
	 * Writes the anchor that GitHub gives to a heading: lower case, punctuation removed, and a dash for each space.
	 * @param text The text of the heading.
	 * @returns The anchor of the heading, before the number that GitHub adds to a repeated anchor.
	 */
	static slug(text: string): string {
		return text
			.trim()
			.toLowerCase()
			.replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
			.replace(/ /g, '-');
	}

	/**
	 * Finds the element of an anchor in the rendered text: an element with this identifier or this name, or else the heading
	 * whose GitHub anchor is the anchor. A repeated heading gets `-1`, `-2`, and so on, as on GitHub.
	 * @param container The element that holds the rendered text.
	 * @param anchor The anchor, without the sign `#`.
	 * @returns The element of the anchor, or null when the rendered text has no such element.
	 */
	static findAnchor(container: HTMLElement, anchor: string): HTMLElement | null {
		for (const element of Array.from(container.querySelectorAll<HTMLElement>('[id], a[name]'))) {
			if (element.id === anchor || element.getAttribute('name') === anchor) {
				return element;
			}
		}
		const wanted = anchor.toLowerCase();
		const counts = new Map<string, number>();
		for (const heading of Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))) {
			const base = MarkdownLinks.slug(heading.textContent ?? '');
			const count = counts.get(base) ?? 0;
			counts.set(base, count + 1);
			const headingAnchor = count === 0 ? base : `${base}-${count}`;
			if (headingAnchor === wanted) {
				return heading;
			}
		}
		return null;
	}

	/**
	 * Reads the number of a line from a GitHub line anchor such as `L42` or `L42-L50`.
	 * @param anchor The anchor, without the sign `#`.
	 * @returns The number of the first line, or null when the anchor is not a line anchor.
	 */
	static lineOfAnchor(anchor: string): number | null {
		const match = /^L(\d+)(?:-L?\d+)?$/.exec(anchor);
		if (match === null) {
			return null;
		}
		return Number(match[1]);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Decodes the escaped characters of a link, for example `%20` for a space.
	 * @param text The part of the link.
	 * @returns The decoded text, or the text as it is when it is not correctly escaped.
	 */
	private static _decode(text: string): string {
		try {
			return decodeURIComponent(text);
		} catch {
			return text;
		}
	}

	/**
	 * Removes the parts `.` and `..` and the repeated slashes of an absolute path.
	 * @param path The absolute path.
	 * @returns The absolute path with no part `.` or `..`.
	 */
	private static _normalize(path: string): string {
		const parts: string[] = [];
		for (const part of path.split('/')) {
			if (part === '' || part === '.') {
				continue;
			}
			if (part === '..') {
				parts.pop();
				continue;
			}
			parts.push(part);
		}
		return `/${parts.join('/')}`;
	}
}
