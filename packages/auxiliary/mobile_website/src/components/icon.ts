import heidrunGoatOnly from '../../../../../data/images/heidrun_icon_goat_only.svg?raw';
import arrowClockwise from 'bootstrap-icons/icons/arrow-clockwise.svg?raw';
import bell from 'bootstrap-icons/icons/bell.svg?raw';
import chevronLeft from 'bootstrap-icons/icons/chevron-left.svg?raw';
import gear from 'bootstrap-icons/icons/gear.svg?raw';
import grid from 'bootstrap-icons/icons/grid.svg?raw';
import lightningCharge from 'bootstrap-icons/icons/lightning-charge.svg?raw';
import micFill from 'bootstrap-icons/icons/mic-fill.svg?raw';
import play from 'bootstrap-icons/icons/play.svg?raw';
import playFill from 'bootstrap-icons/icons/play-fill.svg?raw';
import sendFill from 'bootstrap-icons/icons/send-fill.svg?raw';
import stopFill from 'bootstrap-icons/icons/stop-fill.svg?raw';
import viewStacked from 'bootstrap-icons/icons/view-stacked.svg?raw';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Icon — the page icons and the Heidrun Code branding icon, drawn as inline SVG
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The name of a Bootstrap icon or the shared Heidrun Code branding icon. */
export type IconName =
	| 'arrow-clockwise'
	| 'bell'
	| 'chevron-left'
	| 'gear'
	| 'grid'
	| 'heidrun-goat-only'
	| 'lightning-charge'
	| 'mic-fill'
	| 'play'
	| 'play-fill'
	| 'send-fill'
	| 'stop-fill'
	| 'view-stacked';

/**
 * Draws the Bootstrap icons and the shared Heidrun Code branding icon. Vite puts the SVG in the built page, so the
 * page loads no icon font and no file from another address.
 */
export class Icon {
	/** The SVG text from Bootstrap Icons or the shared Heidrun Code branding image. */
	private static readonly svgByName: Record<IconName, string> = {
		'arrow-clockwise': arrowClockwise,
		'bell': bell,
		'chevron-left': chevronLeft,
		'gear': gear,
		'grid': grid,
		'heidrun-goat-only': heidrunGoatOnly,
		'lightning-charge': lightningCharge,
		'mic-fill': micFill,
		'play': play,
		'play-fill': playFill,
		'send-fill': sendFill,
		'stop-fill': stopFill,
		'view-stacked': viewStacked,
	};

	/**
	 * Draws one icon. The icon takes the color of the text around it.
	 * @param name The name of the Bootstrap icon or the Heidrun Code branding icon.
	 * @param size The width and the height of the icon, in pixels.
	 * @returns The HTML of the icon: an SVG element, hidden from screen readers.
	 */
	static render(name: IconName, size: number): string {
		const svgText = Icon.svgByName[name];
		const iconHtmlContent = svgText
			.replace('width="16" height="16"', `width="${size}" height="${size}" aria-hidden="true"`)
			.trim();
		return iconHtmlContent;
	}
}
