import type { LauncherStatus, LauncherView, LaunchersAnswer, LauncherWorkspaceView } from '../mobile_types';
import { HtmlEscape } from '../html_escape';
import { ScreenHeader } from '../components/screen_header';
import { Icon } from '../components/icon';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	LaunchersScreen — the launchers of the project of each workspace, with the buttons Run and Stop
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The list of the launchers, grouped by workspace. A launcher runs its command in its own tab on the computer, like
 * the button Run of the Launchers sidebar section.
 */
export class LaunchersScreen {
	/** The word of each status of a launcher. */
	private static readonly statusLabels: Record<LauncherStatus, string> = {
		idle: 'Not started',
		running: 'Running',
		finished: 'Finished',
	};

	/** The color name of each status of a launcher, as the classes `dot-…` and `badge-…` of the page name it. */
	private static readonly statusColors: Record<LauncherStatus, string> = {
		idle: 'idle',
		running: 'working',
		finished: 'done',
	};

	/**
	 * Draws the screen.
	 * @param answer The answer of the method `launchers`, or null before the first answer.
	 * @param isOnline True when the last call worked, false when it failed, null before the first call.
	 * @returns The HTML of the screen, without the bottom bar.
	 */
	static render(answer: LaunchersAnswer | null, isOnline: boolean | null): string {
		const screenHtmlContent = /* html */`
			${ScreenHeader.renderTab('Launchers', isOnline)}
			<main>${LaunchersScreen.renderWorkspaces(answer)}</main>
		`;
		return screenHtmlContent;
	}

	/**
	 * Draws the launchers of every workspace.
	 * @param answer The answer of the method `launchers`, or null before the first answer.
	 * @returns The HTML of the workspaces.
	 */
	private static renderWorkspaces(answer: LaunchersAnswer | null): string {
		if (answer === null) {
			const loadingHtmlContent = /* html */`<div class="empty">Loading the launchers…</div>`;
			return loadingHtmlContent;
		}
		if (answer.workspaces.length === 0) {
			const emptyHtmlContent = /* html */`
				<div class="empty">No launcher. Add a launcher in the Launchers sidebar section of Heidrun Code.</div>
			`;
			return emptyHtmlContent;
		}
		return answer.workspaces.map((workspace) => LaunchersScreen.renderWorkspace(workspace)).join('');
	}

	/**
	 * Draws the launchers of one workspace, or the error of its project file.
	 * @param workspace The workspace.
	 * @returns The HTML of the workspace.
	 */
	private static renderWorkspace(workspace: LauncherWorkspaceView): string {
		const errorHtmlContent =
			workspace.error === null ? '' : /* html */`<div class="detail">${HtmlEscape.escape(workspace.error)}</div>`;
		const launchersHtmlContent = workspace.launchers
			.map((launcher) => LaunchersScreen.renderLauncher(workspace.id, launcher))
			.join('');
		const workspaceHtmlContent = /* html */`
			<h2 class="eyebrow">${HtmlEscape.escape(workspace.label)}</h2>
			${errorHtmlContent}
			<div class="list">${launchersHtmlContent}</div>
		`;
		return workspaceHtmlContent;
	}

	/**
	 * Draws one launcher: its name, its status, its description or its command, and the button Run or Stop.
	 * @param workspaceId The identifier of the workspace of the launcher.
	 * @param launcher The launcher.
	 * @returns The HTML of the card.
	 */
	private static renderLauncher(workspaceId: string, launcher: LauncherView): string {
		const color = LaunchersScreen.statusColors[launcher.status];
		const label = LaunchersScreen.statusLabels[launcher.status];
		const descriptionHtmlContent =
			launcher.description === null
				? /* html */`<div class="detail">${HtmlEscape.escape(launcher.command)}</div>`
				: /* html */`<div class="sub">${HtmlEscape.escape(launcher.description)}</div>`;
		const ids = /* html */`
			data-workspace-id="${HtmlEscape.escape(workspaceId)}"
			data-launcher-id="${HtmlEscape.escape(launcher.id)}"
		`;
		const buttonHtmlContent =
			launcher.status === 'running'
				? /* html */`
					<button class="button button-danger" data-action="stop-launcher" ${ids}>
						${Icon.render('stop-fill', 16)} Stop
					</button>
				`
				: /* html */`
					<button class="button button-primary" data-action="run-launcher" ${ids}>
						${Icon.render('play-fill', 16)} Run
					</button>
				`;
		const launcherHtmlContent = /* html */`
			<article class="card launcher">
				<div class="row">
					<span class="dot dot-${color}"></span>
					<span class="name">${HtmlEscape.escape(launcher.label)}</span>
					<span class="badge badge-${color}">${label}</span>
				</div>
				${descriptionHtmlContent}
				<div class="actions">${buttonHtmlContent}</div>
			</article>
		`;
		return launcherHtmlContent;
	}
}
