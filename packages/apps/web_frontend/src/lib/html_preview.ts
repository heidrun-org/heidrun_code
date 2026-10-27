///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HtmlPreview — the address and the messages of the HTML preview of the file view pane
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The type of the message that the page of the preview sends when the developer clicks a link to a web site. */
const OPEN_URL_MESSAGE_TYPE = 'heidrun-html-preview-open-url';

/**
 * Shows an HTML file of a project in a sandboxed frame of the file view pane, served by a small web server of the desktop
 * application on the loopback address (issues #925 and #930).
 */
export class HtmlPreview {
	/**
	 * Tells whether a file is an HTML file.
	 * @param path The path of the file, or null.
	 * @returns True for the extensions `.html` and `.htm`.
	 */
	static isHtml(path: string | null): boolean {
		if (path === null) {
			return false;
		}
		return /\.html?$/i.test(path);
	}

	/**
	 * Writes the address of a file of a project for the frame of the preview.
	 * @param projectAddress The address of the project folder that `html_preview_open` gives,
	 * `http://127.0.0.1:<port>/<secret key>/`.
	 * @param path The path of the file inside the project, with `/` between the folders.
	 * @returns The address of the project folder, then the path with each folder encoded.
	 */
	static fileAddress(projectAddress: string, path: string): string {
		const encodedPath = path.split('/').map((part) => encodeURIComponent(part)).join('/');
		return `${projectAddress}${encodedPath}`;
	}

	/**
	 * Reads the web site to open from a message of the page of the preview.
	 * @param data The data of the message.
	 * @returns The address in HTTP or HTTPS, or null when the message is not a click on a link to a web site.
	 */
	static openUrlOf(data: unknown): string | null {
		if (typeof data !== 'object' || data === null) {
			return null;
		}
		const message = data as { type?: unknown; url?: unknown };
		if (message.type !== OPEN_URL_MESSAGE_TYPE || typeof message.url !== 'string') {
			return null;
		}
		if (/^https?:\/\//i.test(message.url) === false) {
			return null;
		}
		return message.url;
	}
}
