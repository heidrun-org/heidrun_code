import Fs from 'node:fs';
import Path from 'node:path';
import { chromium } from 'playwright-core';
import { ViteServers } from './vite_servers.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PromotionalPictures — draws the pictures that the video needs, with a headless browser
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The texts and the image of the outro card.
 */
export type OutroCardOptions = {
	/** The path of the picture of the baby goat. */
	babyGoatPath: string;
	/** The motto of Heidrun Code. */
	motto: string;
	/** The address of the website of Heidrun Code. */
	address: string;
	/** The width of the picture, in pixels. */
	width: number;
	/** The height of the picture, in pixels. */
	height: number;
	/** The path of the PNG file to write. */
	outputPath: string;
};

/**
 * Draws a picture with a browser, because the program `ffmpeg` of this computer has no filter that draws text. A
 * picture is an HTML page that the browser draws once and saves as a PNG file. The program `ffmpeg` then puts the
 * picture on the video. The comic word has a transparent background.
 */
export class PromotionalPictures {
	/** The folder of the package `web_frontend`, which holds the real splash screen of the application. */
	private static readonly _WEB_FRONTEND_FOLDER = Path.resolve(__dirname, '../../../apps/web_frontend');

	/** The number of points of the comic burst behind the word. */
	private static readonly _BURST_POINTS = 14;

	/**
	 * Saves a picture of the real splash screen of the application. It opens the page of the package `web_frontend` in
	 * a plain browser, where the splash screen shows by itself, and it saves the picture as soon as the image is loaded,
	 * before the splash screen closes after three seconds. The picture holds the background image, the title, the motto
	 * on its arc, and the sound button, exactly as the application draws them.
	 * @param width The width of the browser window, in pixels.
	 * @param height The height of the browser window, in pixels.
	 * @param outputPath The path of the PNG file to write.
	 */
	static async renderSplashScreen(width: number, height: number, outputPath: string): Promise<void> {
		const { server, address } = await ViteServers.start(PromotionalPictures._WEB_FRONTEND_FOLDER);
		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage({
				viewport: {
					width,
					height,
				},
			});
			await page.goto(address);
			await page.waitForSelector('.splash-image');
			await page.waitForFunction(() => {
				const image = document.querySelector('.splash-image');
				return image instanceof HTMLImageElement && image.complete === true && image.naturalWidth > 0;
			});
			await page.evaluate(() => document.fonts.ready);
			await page.locator('.splash').screenshot({ path: outputPath });
		} finally {
			await browser.close();
			await server.close();
		}
	}

	/**
	 * Draws a comic word in a burst, on a transparent background.
	 * @param word The word, for example "POW!".
	 * @param outputPath The path of the PNG file to write.
	 */
	static async renderComicWord(word: string, outputPath: string): Promise<void> {
		const htmlContent = /* html */`
			<html>
				<body style="margin: 0; background: transparent;">
					<svg id="comic" xmlns="http://www.w3.org/2000/svg" width="460" height="320" viewBox="0 0 460 320">
						<polygon points="${PromotionalPictures._burstPoints(230, 160, 220, 130, 4)}" fill="#111111" />
						<polygon points="${PromotionalPictures._burstPoints(230, 160, 205, 118, 0)}" fill="#e63b2e" />
						<polygon points="${PromotionalPictures._burstPoints(230, 160, 170, 92, 0)}" fill="#ffd400" />
						<text x="230" y="205" text-anchor="middle" transform="rotate(-7 230 160)"
							font-family="Impact, 'Arial Black', sans-serif" font-size="128" fill="#e63b2e"
							stroke="#111111" stroke-width="10" paint-order="stroke fill">${PromotionalPictures._escapeHtml(word)}</text>
					</svg>
				</body>
			</html>
		`;
		await PromotionalPictures._screenshot(htmlContent, '#comic', 460, 320, outputPath);
	}

	/**
	 * Draws the outro card: a black background, the baby goat, the motto, and the address of the website.
	 * @param options The texts, the image, the size, and the path to write.
	 */
	static async renderOutroCard(options: OutroCardOptions): Promise<void> {
		const babyGoatBase64 = Fs.readFileSync(options.babyGoatPath).toString('base64');
		const htmlContent = /* html */`
			<html>
				<body style="margin: 0; background: #000000;">
					<div id="card" style="width: ${options.width}px; height: ${options.height}px; background: #000000;
						display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
						font-family: 'Helvetica Neue', Arial, sans-serif;">
						<img src="data:image/png;base64,${babyGoatBase64}" style="height: 340px; width: 340px;" />
						<div style="color: #ffffff; font-size: 52px; font-weight: 800;">
							${PromotionalPictures._escapeHtml(options.motto)}
						</div>
						<div style="color: #f5a524; font-size: 34px; font-weight: 600;">
							${PromotionalPictures._escapeHtml(options.address)}
						</div>
					</div>
				</body>
			</html>
		`;
		await PromotionalPictures._screenshot(htmlContent, '#card', options.width, options.height, options.outputPath);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Draws an HTML page and saves one element of the page as a PNG file with a transparent background.
	 * @param htmlContent The HTML of the page.
	 * @param selector The selector of the element to save.
	 * @param width The width of the browser window, in pixels.
	 * @param height The height of the browser window, in pixels.
	 * @param outputPath The path of the PNG file to write.
	 */
	private static async _screenshot(
		htmlContent: string,
		selector: string,
		width: number,
		height: number,
		outputPath: string,
	): Promise<void> {
		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage({
				viewport: {
					width,
					height,
				},
			});
			await page.setContent(htmlContent);
			await page.locator(selector).screenshot({
				path: outputPath,
				omitBackground: true,
			});
		} finally {
			await browser.close();
		}
	}

	/**
	 * Computes the points of a comic burst: a star with a long point and a short point in turn.
	 * @param centerX The x of the center.
	 * @param centerY The y of the center.
	 * @param longRadiusX The horizontal radius of the long points.
	 * @param shortRadiusX The horizontal radius of the short points.
	 * @param grow How much to add to the vertical radius.
	 * @returns The value of the attribute `points` of an SVG polygon.
	 */
	private static _burstPoints(
		centerX: number,
		centerY: number,
		longRadiusX: number,
		shortRadiusX: number,
		grow: number,
	): string {
		const points: string[] = [];
		for (let index = 0; index < PromotionalPictures._BURST_POINTS * 2; index++) {
			const angle = (index * Math.PI) / PromotionalPictures._BURST_POINTS;
			const radiusX = (index % 2 === 0 ? longRadiusX : shortRadiusX) + grow;
			const radiusY = radiusX * 0.7;
			points.push(`${(centerX + Math.cos(angle) * radiusX).toFixed(1)},${(centerY + Math.sin(angle) * radiusY).toFixed(1)}`);
		}
		return points.join(' ');
	}

	/**
	 * Escapes a text so that it is safe inside HTML.
	 * @param text The text.
	 * @returns The text, with the characters of HTML replaced.
	 */
	private static _escapeHtml(text: string): string {
		return text
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;');
	}
}
