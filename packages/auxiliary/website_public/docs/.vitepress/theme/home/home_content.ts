///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HomeContent — the texts and the images of the sections of the homepage
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One screenshot of the Heidrun Code window, in the folder `docs/public/screenshots`. */
export type HomeScreenshot = {
	/** The path of the image under the base path of the website, for example `/screenshots/window.png`. */
	src: string;
	/** The description of the image for screen readers. */
	alt: string;
	/** The width of the image in pixels, so that the page keeps its place before the image loads. */
	width: number;
	/** The height of the image in pixels. */
	height: number;
};

/** A section of the homepage with a title, some paragraphs, a joke, and a screenshot. */
export type HomeFeatureSection = {
	/** The identifier of the section, used as the anchor of its title. */
	id: string;
	/** The title of the section. */
	title: string;
	/** The paragraphs that say what Heidrun Code does. They come before the joke. */
	paragraphs: string[];
	/** The joke of the section, said by the goat after the explanation. */
	joke: string;
	/** The screenshot of the section. A section without a real capture yet has no screenshot, and shows its text alone. */
	screenshot?: HomeScreenshot;
	/** The link to the page of the website that explains the feature in more detail. */
	readMore: HomeLink;
};

/** The state of a coding agent, with the color that the Heidrun Code window gives it. */
export type HomeAgentState = 'blocked' | 'question' | 'working' | 'done';

/** One terminal of the illustration of the problem. */
export type HomeTerminal = {
	/** The title of the terminal: the coding agent and the folder. */
	title: string;
	/** The last line that the coding agent wrote in the terminal. */
	line: string;
	/** The state of the coding agent. */
	state: HomeAgentState;
};

/** One part of the window that the section "Welcome to Valhalla" outlines on the screenshot. */
export type HomeWindowPart = {
	/** The name of the part, as the glossary writes it. */
	name: string;
	/** What the part shows, in one sentence. */
	description: string;
	/** The outline of the part on the screenshot, in percent of the width and of the height of the image. */
	box: {
		/** The distance from the left edge of the image. */
		left: number;
		/** The distance from the top edge of the image. */
		top: number;
		/** The width of the outline. */
		width: number;
		/** The height of the outline. */
		height: number;
	};
};

/** One item of the section "The whole longhouse in one window". */
export type HomeLonghouseItem = {
	/** The name of the part of Heidrun Code, as the glossary writes it. */
	name: string;
	/** What the part does for the developer, in one or two sentences. */
	description: string;
	/** The path of the page of the website that explains the part, when the page exists. */
	href?: string;
};

/** One group of items of the section "The whole longhouse in one window", by the place where they live. */
export type HomeLonghouseGroup = {
	/** The place of the window where the items live. */
	place: string;
	/** The items of the group. */
	items: HomeLonghouseItem[];
};

/** One row of the map between the Norse mythology and the developer. */
export type HomeMythologyRow = {
	/** The word of the myth. */
	myth: string;
	/** What the word means for the developer. */
	developer: string;
};

/** A link of the homepage. */
export type HomeLink = {
	/** The text of the link. */
	text: string;
	/** The address of the link: a path of the website, or a full web address. */
	href: string;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Links
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The page of the latest release on GitHub, with the file of the application for macOS. */
export const DOWNLOAD_URL = 'https://github.com/heidrun-org/heidrun_code/releases/latest';

/** The repository of Heidrun Code on GitHub. */
export const REPOSITORY_URL = 'https://github.com/heidrun-org/heidrun_code';

/** The issues of Heidrun Code on GitHub. */
export const ISSUES_URL = 'https://github.com/heidrun-org/heidrun_code/issues';

/** The rules for the contributors, in the repository. */
export const AGENTS_URL = 'https://github.com/heidrun-org/heidrun_code/blob/main/AGENTS.md';

/** The website of Herdr, the terminal multiplexer that Heidrun Code needs. */
export const HERDR_URL = 'https://herdr.dev';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Hero
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The short line under the buttons of the hero. */
export const HERO_NOTE = 'Free and open source, under the MIT license. For macOS on Apple silicon.';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	The problem
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The section that explains the problem, before Heidrun Code. */
export const PROBLEM = {
	id: 'the-problem',
	title: 'Five coding agents. Five terminals. One goat.',
	paragraphs: [
		'You start Claude Code in one terminal, Codex in a second one, and three more for good measure. Each coding agent works alone for minutes, then stops to ask you something: a decision, a permission, or a code review.',
		'Each question waits in a different terminal. You switch, you scroll, you search. The coding agents are fast. The slow part is now you.',
	],
	joke: 'The einherjar wait for the feast. Your coding agents wait for you.',
	caption: 'An illustration of a normal afternoon without Heidrun Code.',
	terminals: [
		{
			title: 'claude — api',
			line: 'Do you want to run pnpm test?  1. Yes  2. No',
			state: 'blocked',
		},
		{
			title: 'codex — web',
			line: 'Working… (2m 14s)',
			state: 'working',
		},
		{
			title: 'claude — docs',
			line: 'Should the new page go under /guides or under /documentation?',
			state: 'question',
		},
		{
			title: 'codex — migration',
			line: 'Done. 14 files changed. Ready for your review.',
			state: 'done',
		},
		{
			title: 'claude — tests',
			line: 'Do you want to make this edit to session.ts?  1. Yes  2. No',
			state: 'blocked',
		},
	] satisfies HomeTerminal[],
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Welcome to Valhalla
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The section that shows the whole window, with an outline on each main part. */
export const VALHALLA = {
	id: 'welcome-to-valhalla',
	title: 'Welcome to Valhalla',
	paragraphs: [
		'Heidrun Code is an application for macOS. It shows every coding agent and every terminal of your Herdr session in one window. You see the work of all your coding agents at the same time, and the ones that need you stand out.',
	],
	joke: 'Valhalla has 540 doors, so there is always room for one more terminal.',
	screenshot: {
		src: '/screenshots/window.png',
		alt: 'The Heidrun Code window in the dark theme: the File explorer sidebar section on the left, three panes with Claude Code and Codex in the middle, and a blocked coding agent in the Needs you sidebar section on the right.',
		width: 2400,
		height: 1506,
	} satisfies HomeScreenshot,
	partsLabel: 'Choose a part of the window to outline it on the screenshot.',
	parts: [
		{
			name: 'Left sidebar',
			description: 'Here, the File explorer sidebar section. The Source control, Launchers, and Code hosting sidebar sections live here too.',
			box: {
				left: 0.3,
				top: 4.3,
				width: 25,
				height: 92,
			},
		},
		{
			name: 'Tab bar',
			description: 'The tabs of the selected workspace. A workspace is one project folder.',
			box: {
				left: 25.8,
				top: 4.4,
				width: 54.2,
				height: 3.8,
			},
		},
		{
			name: 'Panes',
			description: 'Real terminals. Each pane runs a shell or a coding agent.',
			box: {
				left: 25.8,
				top: 8.1,
				width: 54.2,
				height: 88.1,
			},
		},
		{
			name: 'Needs you sidebar section',
			description: 'The coding agents that are blocked, that ask a question, or that have finished.',
			box: {
				left: 80.6,
				top: 4.3,
				width: 15.6,
				height: 92,
			},
		},
		{
			name: 'Status bar',
			description: 'The workspace, the Git branch, and the quotas of Claude and Codex.',
			box: {
				left: 0,
				top: 96.3,
				width: 100,
				height: 3.7,
			},
		},
	] satisfies HomeWindowPart[],
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Features
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The four sections that each present one main feature, with a screenshot. */
export const FEATURES: HomeFeatureSection[] = [
	{
		id: 'know-which-one-needs-you',
		title: 'Know which one needs you',
		paragraphs: [
			'The Needs you sidebar section holds one card for each coding agent that is blocked, that asks a question, or that has finished. The blocked coding agents come first, and their number turns red.',
			'Answer a blocked coding agent from its card, or click the card to go to its pane. The status item in the macOS menu bar shows the same states, even when the window is hidden.',
		],
		joke: 'The goat does not search the hall. The hall calls the goat.',
		readMore: {
			text: 'Read more about the Needs you sidebar section',
			href: '/features/needs_you',
		},
		screenshot: {
			src: '/screenshots/needs_you.png',
			alt: 'The Needs you sidebar section with the card of a blocked coding agent that waits for a decision, and its five answers as buttons.',
			width: 1200,
			height: 898,
		},
	},
	{
		id: 'real-terminals',
		title: 'Real terminals, no costume',
		paragraphs: [
			'Each pane shows the real Herdr terminal. Claude Code, Codex, and Antigravity look and work exactly as you know them. Nothing is wrapped and nothing is rewritten.',
			'Split a pane to the right or down. Pin a pane, so that it stays visible when you change the tab or the workspace. Drop an image on a terminal to paste it. Go back and forward through the panes that had the focus, as in a web browser.',
		],
		joke: 'Real Vikings wore no horns. Real terminals wear no costume.',
		readMore: {
			text: 'Read more about the panes',
			href: '/features/panes',
		},
		screenshot: {
			src: '/screenshots/panes.png',
			alt: 'Three panes in one tab: Claude Code on the left, Codex on the right, and under Codex a second Claude Code that waits for a decision.',
			width: 1600,
			height: 1150,
		},
	},
	{
		id: 'watch-the-mead-level',
		title: 'Watch the mead level',
		paragraphs: [
			'The usage wheel in the header of each pane shows how much of the context window the coding agent has used. It turns orange, then red, before the context window is full.',
			'The status bar shows your Claude quotas, for 5 hours and for the week, and your Codex quotas, with the pace of your use. You know that you will run dry before it happens.',
		],
		joke: 'In the myth, the mead never runs out. In real life, the quota does.',
		readMore: {
			text: 'Read more about the quotas and the usage wheel',
			href: '/features/quotas',
		},
		screenshot: {
			src: '/screenshots/quotas.png',
			alt: 'A Claude Code pane in the light theme, with its usage wheel in the header, and under it the status bar with the Claude quota at 62% and the Codex quota at 3%.',
			width: 1200,
			height: 1408,
		},
	},
	{
		id: 'valhalla-fits-in-a-pocket',
		title: 'Valhalla fits in a pocket',
		paragraphs: [
			'Leave your desk. From your phone, see which coding agent waits, allow or refuse its request, send a prompt, and read the end of its output.',
			'The phone connects through an ngrok tunnel, and every call needs a pairing key. Each phone pairs once, with a QR code.',
		],
		joke: 'Go get your coffee. Your coding agents will find you.',
		readMore: {
			text: 'Read more about the phone access',
			href: '/features/phone_access',
		},
	},
];

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	The whole longhouse in one window
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The section that lists the other parts of Heidrun Code, grouped by the place where they live in the window. */
export const LONGHOUSE = {
	id: 'the-whole-longhouse',
	title: 'The whole longhouse in one window',
	paragraphs: [
		'Everything that you need around your coding agents, without a second application.',
	],
	joke: 'Even a berserker needs a second thought.',
	groups: [
		{
			place: 'On the keyboard',
			items: [
				{
					name: 'Command palette',
					description: 'Press ⌘K to find every action. A real Viking does not use the mouse.',
				},
				{
					name: 'Macros',
					description: 'One click writes a ready text into a pane, so your coding agents never wait while you type the same sentence again.',
				},
			],
		},
		{
			place: 'In the left sidebar',
			items: [
				{
					name: 'Launchers sidebar section',
					description: 'Run the commands of your project, each in its own tab. Import them from package.json in one click.',
					href: '/features/sidebar_sections',
				},
				{
					name: 'Source control sidebar section',
					description: 'Stage, commit, and read the diff, as in Visual Studio Code.',
					href: '/features/sidebar_sections',
				},
				{
					name: 'Code hosting sidebar section',
					description: 'The open issues and the pull requests of GitHub, or the merge requests of GitLab, with saved searches.',
					href: '/features/sidebar_sections',
				},
				{
					name: 'File explorer sidebar section',
					description: 'The whole folder tree of the repository. Open a file to read it or to edit it.',
					href: '/features/sidebar_sections',
				},
			],
		},
		{
			place: 'In the right sidebar',
			items: [
				{
					name: 'Clipboard sidebar section',
					description: 'Pin a piece of the text of a terminal as a note, and find it again later.',
					href: '/features/sidebar_sections',
				},
				{
					name: 'Past chats sidebar section',
					description: 'Every chat of Claude Code and of Codex for this workspace, with its files, its issues, its tokens, and its estimated cost.',
					href: '/features/past_chats',
				},
			],
		},
		{
			place: 'In their own windows',
			items: [
				{
					name: 'Statistics window',
					description: 'How long you really worked in each workspace, what each person changed, and what the coding agents cost each day.',
					href: '/features/statistics',
				},
				{
					name: 'Skills',
					description: 'Install a skill from skills.sh or from a folder on GitHub, for each coding agent that you use.',
				},
			],
		},
		{
			place: 'Before each command',
			items: [
				{
					name: 'Confirmation of dangerous commands',
					description: 'A dangerous command asks before it runs, and your project can block a command for good.',
				},
			],
		},
	] satisfies HomeLonghouseGroup[],
	aiLink: {
		text: 'Read where Heidrun Code uses AI, and what it sends',
		href: '/features/ai',
	} satisfies HomeLink,
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Board the longship
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The section that tells how to get Heidrun Code. */
export const QUICK_START = {
	id: 'board-the-longship',
	title: 'Board the longship',
	joke: 'Four commands. A longship needs more oars than that.',
	download: {
		title: 'Download the application',
		text: 'Download the file for macOS on Apple silicon from the latest release, and drag Heidrun Code into the folder Applications. First install Herdr 0.9 or later: Heidrun Code needs it, and does not install it. The program ngrok is optional: only the mobile access uses it.',
		herdrInstallCommand: 'curl -fsSL https://herdr.dev/install.sh | sh',
		buttonText: 'Download for macOS',
		herdrLinkText: 'Get Herdr',
	},
	source: {
		title: 'Build it from the source',
		text: 'You need Herdr 0.9 or later, Rust stable, Node.js 20 or later, and pnpm.',
		commands: [
			'git clone https://github.com/heidrun-org/heidrun_code.git',
			'cd heidrun',
			'pnpm install',
			'pnpm dev',
		],
		copyText: 'Copy the commands',
		copiedText: 'Copied',
	},
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Built by the herd, for the herd
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The section about the open source project and how to contribute. */
export const OPEN_SOURCE = {
	id: 'built-by-the-herd',
	title: 'Built by the herd, for the herd',
	paragraphs: [
		'Heidrun Code is free and open source, under the MIT license. Read the code, change it, and share your change.',
		'The application is written in Rust with Tauri 2. The window is written in TypeScript with Vue 3. To contribute, read the rules of the repository, then open an issue before you start a change.',
	],
	links: [
		{
			text: 'Read the code on GitHub',
			href: REPOSITORY_URL,
		},
		{
			text: 'Read the rules of the repository',
			href: AGENTS_URL,
		},
		{
			text: 'Report a Ragnarök',
			href: ISSUES_URL,
		},
	] satisfies HomeLink[],
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Who is Heiðrún?
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The section about the goat of the Norse mythology, and the map of the mythology words. */
export const MYTHOLOGY = {
	id: 'who-is-heidrun',
	title: 'Who is Heiðrún?',
	paragraphs: [
		'Heiðrún is a goat of the Norse mythology. She stands on top of Valhalla, eats the leaves of the tree Læraðr, and gives mead to all the warriors of the hall, every day, without end. Heidrun Code the application does the same for your coding agents.',
	],
	joke: 'We do not talk about Ragnarök before breakfast.',
	mythHeading: 'In the myth',
	developerHeading: 'For you',
	rows: [
		{
			myth: 'The einherjar, the warriors of Valhalla',
			developer: 'Your coding agents',
		},
		{
			myth: 'Valhalla, the hall of Odin',
			developer: 'The Heidrun Code window',
		},
		{
			myth: 'The mead',
			developer: 'Your answers, and your quota of tokens',
		},
		{
			myth: 'The goat Heiðrún',
			developer: 'You: the GOAT, the Greatest Of All Time',
		},
		{
			myth: 'Ragnarök',
			developer: 'A merge conflict',
		},
		{
			myth: '“Skål!”',
			developer: 'The merge of the pull request',
		},
	] satisfies HomeMythologyRow[],
	aboutLink: {
		text: 'Read the whole story, and hear how to say the name',
		href: '/about',
	} satisfies HomeLink,
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Skål!
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The last section of the homepage, with the last two buttons. */
export const SKAL = {
	id: 'skal',
	title: 'Skål!',
	text: 'Your coding agents are ready. The mead is poured.',
	joke: 'Say “Skål!” after the merge, not before.',
	downloadText: 'Download for macOS',
	repositoryText: 'Star on GitHub',
};
