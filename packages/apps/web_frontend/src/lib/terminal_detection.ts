import type { DetectionFamilyId } from './detection_families';
import { DetectionPatterns } from './detection_patterns';
import { WrappedLines } from './wrapped_lines';
import {
	agentListState,
	findAgentRow,
	findChoices,
	findCommands,
	findFileRefs,
	findInlineShell,
	findQuestion,
	findRefs,
	findShellBlock,
	findStep,
	promptBoxAt,
	type ChoiceMenu,
	type RefContext,
	type RefKind,
	type RefMatch,
	type RefTarget,
} from './refs';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TerminalDetection — decides what Heidrun Code finds in one line of terminal text, and which rule wins
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * What a detected piece of text can do when the developer asks for it. The function that runs an action sits in the
 * terminal component. The sample field of the Settings window only shows the action and never runs it.
 */
export type DetectionAction =
	| {
			/** Opens a web address in the browser. */
			type: 'openAddress';
			/** The web address. */
			url: string;
	  }
	| {
			/** Opens the preview window of an issue, a pull request, or a merge request. */
			type: 'previewIssue';
			/** The issue, the pull request, or the merge request, with its repository when the text names one. */
			target: RefTarget;
			/** The web address of the issue, the pull request, or the merge request. */
			url: string | null;
	  }
	| {
			/** Opens a file in the File explorer sidebar section. */
			type: 'openFile';
			/** The path as the text writes it. It is relative to the folder of the pane when it is not absolute. */
			path: string;
			/** The line to show, or null. */
			line: number | null;
	  }
	| {
			/** Types a text in the prompt of the coding agent of the pane and sends it. */
			type: 'sendPrompt';
			/** The text to send. */
			text: string;
	  }
	| {
			/** Moves the keyboard focus from the agent list back to the input of the coding agent. */
			type: 'backToPrompt';
			/** The number of presses of the up arrow key. */
			steps: number;
	  }
	| {
			/** Shows another agent of the agent list of Claude Code. */
			type: 'switchAgent';
			/** The name of the agent. */
			name: string;
	  };

/** A hover button: its text and the action that a click on it runs. */
export type DetectionButton = {
	/** The key of the text of the button. */
	labelKey: string;
	/** The values of the markers of the text of the button. */
	labelParams: Record<string, string | number>;
	/** The action that a click on the button runs. */
	action: DetectionAction;
};

/** One piece of text that a rule found in one line. */
export type DetectedItem = {
	/** The detection family of the rule. A switch of the family turns the item on or off. */
	family: DetectionFamilyId;
	/** The name of the rule inside its family, for example `hash` for "#12" or `inlineShell`. */
	rule: string;
	/** The index in the line text of the first character of the piece. */
	start: number;
	/** The index in the line text after the last character of the piece. */
	end: number;
	/** The text of the piece. */
	text: string;
	/** The kind of reference, or null when the piece is not a reference. The kind decides the color. */
	kind: RefKind | null;
	/** The main hover button, or null when the rule found the text but has no destination for it. */
	primary: DetectionButton | null;
	/** The second hover button, for example "Preview", or null. */
	secondary: DetectionButton | null;
	/** What a ⌘-click on the text runs, or null when the piece has no action. */
	commandClick: DetectionAction | null;
	/** The resolved web address that the piece goes to, or null. */
	destination: string | null;
	/** The repository that the text names, or null when the text names none. */
	repository: string | null;
	/** True when the text is underlined while the pointer is over it. */
	isUnderlined: boolean;
	/** True when the hover buttons sit on the line after the text, as for the rows of the agent list. */
	isAfterText: boolean;
	/** True when the detection family of the piece is on. A piece of a family that is off is kept for the sample field. */
	isEnabled: boolean;
};

/** A piece of text that a rule found, and that another rule with a higher precedence kept for itself. */
export type SuppressedItem = {
	/** The detection family of the rule that lost. */
	family: DetectionFamilyId;
	/** The name of the rule that lost. */
	rule: string;
	/** The index in the line text of the first character of the piece. */
	start: number;
	/** The index in the line text after the last character of the piece. */
	end: number;
	/** The text of the piece. */
	text: string;
	/** The detection family of the rule that won. */
	byFamily: DetectionFamilyId;
	/** The name of the rule that won. */
	byRule: string;
};

/** What the detection needs to read one line of a terminal. */
export type DetectionInput = {
	/** Returns the text of a screen line, counted from 0 at the top of the screen, or null past the screen. */
	lineAt: (index: number) => string | null;
	/** The index of the line to read. */
	row: number;
	/** The number of lines of the screen. */
	rows: number;
	/** The number of columns of the screen. */
	columns: number;
	/**
	 * True when the last line is the end of the text, as in the sample field of the Settings window. Missing or false for the
	 * screen of a terminal, whose text may go on below the bottom: a command that reaches the bottom is not proposed, rather
	 * than cut (issue #574).
	 */
	textEndsAtLastLine?: boolean;
	/** The repository of the pane, and the project settings of the references. */
	context: RefContext;
	/** The slash commands that Claude Code knows in the folder of the pane. */
	knownCommands: ReadonlySet<string>;
	/** The coding agent that runs in the pane ("claude", "codex"…), or null for a plain terminal. */
	agent: string | null;
	/** The detection families that are on. */
	enabledFamilies: ReadonlySet<DetectionFamilyId>;
};

/** The result of the detection in one line. */
export type DetectionResult = {
	/** The pieces that the rules kept, sorted by position, without overlap. A piece of a family that is off has `isEnabled` false. */
	items: DetectedItem[];
	/** The pieces that a rule of a higher precedence took, with the rule that took them. */
	suppressed: SuppressedItem[];
};

/** The question and the numbered choices that the detection reads in the whole screen of a coding agent. */
export type ScreenDetection = {
	/** The question that ends the last message, or null. */
	question: string | null;
	/** The numbered menu of a blocked agent, or null. */
	choices: ChoiceMenu | null;
	/** True when the detection family "questionsAndChoices" is on. */
	isEnabled: boolean;
};

/** What the detection finds in one line of a sample text. */
export type SampleLine = {
	/** The number of the line in the sample, counted from 1. */
	number: number;
	/** The text of the line. */
	text: string;
	/** The pieces that the rules kept, with the web addresses that no other piece covers, sorted by position. */
	items: DetectedItem[];
	/** The pieces that a rule of a higher precedence took. */
	suppressed: SuppressedItem[];
};

/** What the detection finds in a sample text. The sample field of the Settings window shows it. */
export type SampleDetection = {
	/** The lines of the sample. */
	lines: SampleLine[];
	/** The question and the numbered choices that the whole sample holds, or null when the pane is a plain terminal. */
	screen: ScreenDetection | null;
};

/** The longest command that a hover button shows in full. */
const COMMAND_LABEL_LENGTH = 48;

/** The longest piece of a numbered step that the prompt repeats. */
const STEP_SNIPPET_LENGTH = 90;

/** The detection family of each kind of reference. */
const FAMILY_OF_KIND: Record<RefKind, DetectionFamilyId> = {
	issue: 'issueReferences',
	mr: 'requestReferences',
	ticket: 'tickets',
	commit: 'commits',
};

/** Decides what Heidrun Code finds in the text of a terminal, line by line, and which rule wins when two rules find the same text. */
export class TerminalDetection {
	/**
	 * Gives the detection family of a kind of reference.
	 *
	 * @param kind - The kind of reference.
	 * @returns The detection family that the switch of the kind belongs to.
	 */
	static familyOfKind(kind: RefKind): DetectionFamilyId {
		return FAMILY_OF_KIND[kind];
	}

	/**
	 * Finds the references to color in a line. A reference of a detection family that is off is not returned.
	 *
	 * @param text - The text of the line.
	 * @param context - The repository of the pane, and the project settings of the references.
	 * @param enabledFamilies - The detection families that are on.
	 * @returns The references of the families that are on. The precedence is decided before the families are tested, so a
	 * reference of a family that is off still keeps its text: "PR #12" does not become the issue "#12" when the pull requests are off.
	 */
	static findColoredReferences(text: string, context: RefContext, enabledFamilies: ReadonlySet<DetectionFamilyId>): RefMatch[] {
		return findRefs(text, context).filter((match) => enabledFamilies.has(FAMILY_OF_KIND[match.kind]) === true);
	}

	/**
	 * Builds the item of a reference.
	 *
	 * @param match - The reference that `findRefs` found.
	 * @param text - The text of the line, or the text of the web address.
	 * @param enabledFamilies - The detection families that are on.
	 * @returns The item, with its hover buttons.
	 */
	static referenceItem(match: RefMatch, text: string, enabledFamilies: ReadonlySet<DetectionFamilyId>): DetectedItem {
		const family = FAMILY_OF_KIND[match.kind];
		const piece = text.slice(match.start, match.end);
		const target = match.target;
		const hasDestination = match.url !== null;
		const openAction: DetectionAction | null = match.url === null ? null : { type: 'openAddress', url: match.url };
		const previewAction: DetectionAction | null =
			target === undefined || hasDestination === false ? null : { type: 'previewIssue', target, url: match.url };
		return {
			family,
			rule: match.rule,
			start: match.start,
			end: match.end,
			text: piece,
			kind: match.kind,
			primary:
				openAction === null ? null : { labelKey: 'terminalView.openLink', labelParams: { name: piece }, action: openAction },
			secondary:
				previewAction === null ? null : { labelKey: 'terminalView.preview', labelParams: {}, action: previewAction },
			commandClick: previewAction ?? openAction,
			destination: match.url,
			repository: target?.project ?? null,
			isUnderlined: true,
			isAfterText: false,
			isEnabled: enabledFamilies.has(family),
		};
	}

	/**
	 * Finds the reference that a whole web address is, for the web-link add-on of the terminal. The add-on owns the link of
	 * every web address, and asks this function whether the address is also an issue, a pull request, a merge request, or a commit.
	 *
	 * @param address - The web address that the add-on found, possibly joined from several wrapped lines.
	 * @param context - The repository of the pane, and the project settings of the references.
	 * @param enabledFamilies - The detection families that are on.
	 * @returns The item when the whole address is a reference of a family that is on and that has a destination, else null.
	 */
	static findAddressReference(
		address: string,
		context: RefContext,
		enabledFamilies: ReadonlySet<DetectionFamilyId>,
	): DetectedItem | null {
		const match = findRefs(address, context).find((candidate) => candidate.start === 0);
		if (match === undefined || match.url === null) {
			return null;
		}
		const item = TerminalDetection.referenceItem(match, address, enabledFamilies);
		return item.isEnabled === true ? item : null;
	}

	/**
	 * Reads one line of a terminal.
	 *
	 * @param input - The line, the screen around it, and the context of the pane.
	 * @returns The pieces that the rules kept, and the pieces that a rule of a higher precedence took. The precedence is fixed:
	 * it does not depend on the switches. A switch only turns the items of one family off afterwards.
	 */
	static detectLine(input: DetectionInput): DetectionResult {
		const text = input.lineAt(input.row) ?? '';
		const ordinary = TerminalDetection._detectOrdinary(text, input);
		const wholeLineItem = TerminalDetection._detectWholeLine(text, input);
		if (wholeLineItem === null) {
			return ordinary;
		}
		const lostToWholeLine: SuppressedItem[] = ordinary.items.map((item) => ({
			family: item.family,
			rule: item.rule,
			start: item.start,
			end: item.end,
			text: item.text,
			byFamily: wholeLineItem.family,
			byRule: wholeLineItem.rule,
		}));
		return { items: [wholeLineItem], suppressed: [...lostToWholeLine, ...ordinary.suppressed] };
	}

	/**
	 * Finds the web addresses of a line that no item with an action covers. The web-link add-on makes these links, and the
	 * sample field of the Settings window lists them.
	 *
	 * @param text - The text of the line.
	 * @param items - The items of the line, from `detectLine`.
	 * @param enabledFamilies - The detection families that are on.
	 * @returns The web addresses, as items of the family "webAddresses", or an empty list when the family is off.
	 */
	static findPlainWebAddresses(
		text: string,
		items: readonly DetectedItem[],
		enabledFamilies: ReadonlySet<DetectionFamilyId>,
	): DetectedItem[] {
		const plainItems: DetectedItem[] = [];
		const addressPattern = DetectionPatterns.global(DetectionPatterns.WEB_ADDRESS);
		let match: RegExpExecArray | null;
		while ((match = addressPattern.exec(text)) !== null) {
			const address = match[0];
			const start = match.index;
			const end = start + address.length;
			const isClaimed = items.some(
				(item) => item.isEnabled === true && item.commandClick !== null && start < item.end && end > item.start,
			);
			if (isClaimed === true) {
				continue;
			}
			plainItems.push({
				family: 'webAddresses',
				rule: 'address',
				start,
				end,
				text: address,
				kind: null,
				primary: null,
				secondary: null,
				commandClick: { type: 'openAddress', url: address },
				destination: address,
				repository: null,
				isUnderlined: true,
				isAfterText: false,
				isEnabled: enabledFamilies.has('webAddresses'),
			});
		}
		return plainItems;
	}

	/**
	 * Reads the whole screen text of a coding agent for the question and the numbered choices.
	 *
	 * @param screen - The text of the screen.
	 * @param enabledFamilies - The detection families that are on.
	 * @returns The question and the choices, each null when the screen has none.
	 */
	static detectScreen(screen: string, enabledFamilies: ReadonlySet<DetectionFamilyId>): ScreenDetection {
		return {
			question: findQuestion(screen),
			choices: findChoices(screen),
			isEnabled: enabledFamilies.has('questionsAndChoices'),
		};
	}

	/**
	 * Reads a sample text the way Heidrun Code reads a screen of a terminal. Nothing is opened, sent, or run: the result only
	 * describes what Heidrun Code would propose.
	 *
	 * @param sample - The sample text. Each line of it is a line of the screen.
	 * @param options - The context of the pane: the repository, the slash commands, the coding agent, and the switches.
	 * @returns The pieces found in each line, the pieces that lost to another rule, and the question and the choices.
	 */
	static detectText(sample: string, options: Omit<DetectionInput, 'lineAt' | 'row' | 'rows' | 'columns'>): SampleDetection {
		const textLines = sample.replace(/\r/g, '').split('\n');
		const columns = Math.max(80, ...textLines.map((line) => line.length));
		const lines: SampleLine[] = [];
		for (let row = 0; row < textLines.length; row++) {
			const result = TerminalDetection.detectLine({
				...options,
				lineAt: (index) => textLines[index] ?? null,
				row,
				rows: textLines.length,
				columns,
				textEndsAtLastLine: true,
			});
			const webAddresses = TerminalDetection.findPlainWebAddresses(textLines[row], result.items, options.enabledFamilies);
			lines.push({
				number: row + 1,
				text: textLines[row],
				items: [...result.items, ...webAddresses].sort((first, second) => first.start - second.start),
				suppressed: result.suppressed,
			});
		}
		const screen = options.agent === null ? null : TerminalDetection.detectScreen(sample, options.enabledFamilies);
		return { lines, screen };
	}

	/**
	 * Cuts a command to the length that a hover button shows.
	 *
	 * @param command - The command.
	 * @returns The command, or its first characters followed by an ellipsis when it is long.
	 */
	static shortCommand(command: string): string {
		return command.length > COMMAND_LABEL_LENGTH ? `${command.slice(0, COMMAND_LABEL_LENGTH)}…` : command;
	}

	/**
	 * Reads the rules that claim only a part of the line.
	 *
	 * @param text - The text of the line.
	 * @param input - The line, the screen around it, and the context of the pane.
	 * @returns The pieces that the rules kept, and the pieces that a rule of a higher precedence took.
	 */
	private static _detectOrdinary(text: string, input: DetectionInput): DetectionResult {
		const items: DetectedItem[] = [];
		const suppressed: SuppressedItem[] = [];
		const isClaude = (input.agent ?? '').includes('claude');
		const lose = (candidate: DetectedItem, winner: DetectedItem): void => {
			suppressed.push({
				family: candidate.family,
				rule: candidate.rule,
				start: candidate.start,
				end: candidate.end,
				text: candidate.text,
				byFamily: winner.family,
				byRule: winner.rule,
			});
		};
		const findWinner = (candidate: DetectedItem): DetectedItem | undefined =>
			items.find((placed) => candidate.start < placed.end && candidate.end > placed.start);
		const isOn = (familyId: DetectionFamilyId): boolean => input.enabledFamilies.has(familyId);

		// "lance ! scripts/x.sh." inside a sentence: run it like a "!" block. The sentence is read on all the screen lines
		// that the agent wrapped, so that a long command is never cut at the end of a screen line (issue #574).
		if (input.agent !== null) {
			for (const inline of TerminalDetection._inlineShellsOfRow(input)) {
				items.push({
					family: 'shellCommands',
					rule: 'inlineShell',
					start: inline.start,
					end: inline.end,
					text: text.slice(inline.start, inline.end),
					kind: null,
					primary: TerminalDetection._runCommandButton(inline.command),
					secondary: null,
					commandClick: { type: 'sendPrompt', text: `! ${inline.command}` },
					destination: `! ${inline.command}`,
					repository: null,
					isUnderlined: true,
					isAfterText: false,
					isEnabled: isOn('shellCommands'),
				});
			}
		}

		for (const match of findRefs(text, input.context)) {
			const candidate = TerminalDetection.referenceItem(match, text, input.enabledFamilies);
			const winner = findWinner(candidate);
			if (winner !== undefined) {
				lose(candidate, winner);
				continue;
			}
			items.push(candidate);
		}

		// "src/app.ts:42" cited by the agent (or a compiler): opened in the file explorer.
		for (const file of findFileRefs(text)) {
			const name = file.path.split('/').pop() + (file.line === null ? '' : `:${file.line}`);
			const openAction: DetectionAction = { type: 'openFile', path: file.path, line: file.line };
			const candidate: DetectedItem = {
				family: 'filePaths',
				rule: 'filePath',
				start: file.start,
				end: file.end,
				text: file.path,
				kind: null,
				primary: { labelKey: 'terminalView.openFile', labelParams: { name }, action: openAction },
				secondary: null,
				commandClick: openAction,
				destination: null,
				repository: null,
				isUnderlined: true,
				isAfterText: false,
				isEnabled: isOn('filePaths'),
			};
			const winner = findWinner(candidate);
			if (winner !== undefined) {
				lose(candidate, winner);
				continue;
			}
			items.push(candidate);
		}

		if (isClaude === true) {
			for (const command of findCommands(text, input.knownCommands)) {
				const sendAction: DetectionAction = { type: 'sendPrompt', text: command.command };
				const candidate: DetectedItem = {
					family: 'slashCommands',
					rule: 'slashCommand',
					start: command.start,
					end: command.end,
					text: command.command,
					kind: null,
					primary: { labelKey: 'terminalView.launchCommand', labelParams: { command: command.command }, action: sendAction },
					secondary: null,
					commandClick: sendAction,
					destination: null,
					repository: null,
					isUnderlined: true,
					isAfterText: false,
					isEnabled: isOn('slashCommands'),
				};
				const winner = findWinner(candidate);
				if (winner !== undefined) {
					lose(candidate, winner);
					continue;
				}
				items.push(candidate);
			}
		}

		if (input.agent !== null) {
			const step = findStep(text);
			if (step !== null) {
				// The hover zone of the step stops before any other piece that starts after the step.
				const firstOther = Math.min(step.end, ...items.filter((item) => item.start > step.start).map((item) => item.start));
				const end = text.slice(0, firstOther).trimEnd().length;
				const snippet = step.text.length > STEP_SNIPPET_LENGTH ? `${step.text.slice(0, STEP_SNIPPET_LENGTH)}…` : step.text;
				const promptAction: DetectionAction = {
					type: 'sendPrompt',
					text: `Vas-y pour le point ${step.number} : « ${snippet} »`,
				};
				const candidate: DetectedItem = {
					family: 'numberedSteps',
					rule: 'numberedStep',
					start: step.start,
					end,
					text: text.slice(step.start, end),
					kind: null,
					primary: { labelKey: 'terminalView.doStep', labelParams: { number: step.number }, action: promptAction },
					secondary: null,
					commandClick: promptAction,
					destination: null,
					repository: null,
					isUnderlined: false,
					isAfterText: false,
					isEnabled: isOn('numberedSteps'),
				};
				const coveringItem = items.find((placed) => placed.start <= step.start && placed.end > step.start);
				if (coveringItem !== undefined) {
					lose(candidate, coveringItem);
				} else if (end > step.start) {
					items.push(candidate);
				}
			}
		}

		return { items: items.sort((first, second) => first.start - second.start), suppressed };
	}

	/**
	 * Reads the rules that claim the whole line: the way back to the input, a row of the agent list, and a shell command.
	 * The input box and the agent list exist for Claude Code only; the shell command is read in every pane of a coding agent.
	 *
	 * @param text - The text of the line.
	 * @param input - The line, the screen around it, and the context of the pane.
	 * @returns The item that claims the whole line, or null.
	 */
	private static _detectWholeLine(text: string, input: DetectionInput): DetectedItem | null {
		if (input.agent === null) {
			return null;
		}
		// Codex also suggests "! command" on several lines; the agent list and the input box are of Claude Code only.
		if (input.agent.includes('claude') === false) {
			return TerminalDetection._shellBlockItem(text, input);
		}
		const isOn = (familyId: DetectionFamilyId): boolean => input.enabledFamilies.has(familyId);

		// Selection in the agent list: a click in the prompt box gives the focus back to the text input.
		if (promptBoxAt(input.lineAt, input.row) !== null) {
			const list = agentListState(input.lineAt, input.rows);
			if (list !== null && list.selected !== null) {
				const steps = list.selected + 1;
				const action: DetectionAction = { type: 'backToPrompt', steps };
				return {
					family: 'agentList',
					rule: 'promptBox',
					start: 0,
					end: text.length,
					text,
					kind: null,
					primary: { labelKey: 'terminalView.backToPrompt', labelParams: {}, action },
					secondary: null,
					commandClick: action,
					destination: null,
					repository: null,
					isUnderlined: false,
					isAfterText: true,
					isEnabled: isOn('agentList'),
				};
			}
		}

		// Agent list under the prompt: a click switches to that agent.
		const agentRow = findAgentRow(input.lineAt, input.row, input.rows);
		if (agentRow !== null) {
			// Stop at the end of the description: the elapsed time is pushed to the right edge after a wide gap.
			const gap = /\s{4,}\S/.exec(text.slice(agentRow.start));
			const end = gap === null ? text.trimEnd().length : agentRow.start + gap.index;
			const action: DetectionAction = { type: 'switchAgent', name: agentRow.name };
			return {
				family: 'agentList',
				rule: 'agentRow',
				start: agentRow.start,
				end,
				text: text.slice(agentRow.start, end),
				kind: null,
				primary: {
					labelKey: agentRow.current ? 'terminalView.agentShown' : 'terminalView.showAgent',
					labelParams: { name: agentRow.name },
					action,
				},
				secondary: null,
				commandClick: action,
				destination: null,
				repository: null,
				isUnderlined: true,
				isAfterText: true,
				isEnabled: isOn('agentList'),
			};
		}

		return TerminalDetection._shellBlockItem(text, input);
	}

	/**
	 * Reads a "! command" at the start of a screen line, possibly on several lines, in a pane of a coding agent.
	 *
	 * @param text - The text of the line.
	 * @param input - The line, the screen around it, and the context of the pane.
	 * @returns The item of the command, which claims the line, or null.
	 */
	private static _shellBlockItem(text: string, input: DetectionInput): DetectedItem | null {
		const isOn = (familyId: DetectionFamilyId): boolean => input.enabledFamilies.has(familyId);
		// "! command" suggested by the agent: the whole command, joined on one line, is sent to the prompt and run.
		const block = findShellBlock(input.lineAt, input.row, input.columns, input.textEndsAtLastLine === true);
		if (block !== null) {
			const start = input.row === block.first ? block.start : text.length - text.trimStart().length;
			const end = text.trimEnd().length;
			if (end > start) {
				return {
					family: 'shellCommands',
					rule: 'shellBlock',
					start,
					end,
					text: text.slice(start, end),
					kind: null,
					primary: TerminalDetection._runCommandButton(block.command),
					secondary: null,
					commandClick: { type: 'sendPrompt', text: `! ${block.command}` },
					destination: `! ${block.command}`,
					repository: null,
					isUnderlined: true,
					isAfterText: false,
					isEnabled: isOn('shellCommands'),
				};
			}
		}
		return null;
	}

	/**
	 * Finds the "! command" inside a sentence that cover a screen line. The sentence is the logical line of the screen line:
	 * the screen lines that the agent wrapped into one line.
	 *
	 * @param input - The line, the screen around it, and the context of the pane.
	 * @returns The commands, with the part of the screen line that each covers.
	 */
	private static _inlineShellsOfRow(input: DetectionInput): { start: number; end: number; command: string }[] {
		const logical = WrappedLines.logicalLine(input.lineAt, input.row, input.columns);
		// Too long to read whole: no command, rather than a cut one.
		if (logical === null) {
			return [];
		}
		const segment = logical.segments.find((candidate) => candidate.row === input.row);
		if (segment === undefined) {
			return [];
		}
		const found: { start: number; end: number; command: string }[] = [];
		for (const inline of findInlineShell(logical.text)) {
			// The command runs to the end of the text, at the bottom of the screen: it may go on out of sight.
			if (logical.isCutAtBottom === true && input.textEndsAtLastLine !== true && inline.end >= logical.text.trimEnd().length) {
				continue;
			}
			const from = Math.max(inline.start, segment.offset);
			const to = Math.min(inline.end, segment.offset + segment.length);
			if (from < to) {
				found.push({ start: segment.column + from - segment.offset, end: segment.column + to - segment.offset, command: inline.command });
			}
		}
		return found;
	}

	/**
	 * Builds the hover button that runs a shell command in the prompt of the coding agent.
	 *
	 * @param command - The command, without the exclamation mark.
	 * @returns The hover button.
	 */
	private static _runCommandButton(command: string): DetectionButton {
		return {
			labelKey: 'terminalView.runCommand',
			labelParams: { command: TerminalDetection.shortCommand(command) },
			action: { type: 'sendPrompt', text: `! ${command}` },
		};
	}
}
