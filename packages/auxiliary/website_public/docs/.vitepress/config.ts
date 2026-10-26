import { defineConfig } from 'vitepress';
import identity from '../../../../../data/identity.json';
import { LinkPreviewCards } from './link_preview_cards';

const base = '/heidrun_code/';
const siteAddress = `https://heidrun-org.github.io${base}`;

export default defineConfig({
	title: identity.title,
	description: identity.description.en,
	head: [
		['link', {
			rel: 'icon',
			type: 'image/svg+xml',
			href: `${base}favicon.svg`,
		}],
		['link', {
			rel: 'preconnect',
			href: 'https://fonts.googleapis.com',
		}],
		['link', {
			rel: 'preconnect',
			href: 'https://fonts.gstatic.com',
			crossorigin: '',
		}],
		['link', {
			rel: 'stylesheet',
			href: 'https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400..700&display=swap',
		}],
		...LinkPreviewCards.sharedTags(siteAddress),
	],
	transformHead({ pageData, title, description }) {
		return LinkPreviewCards.pageTags({
			siteAddress,
			title,
			description,
			relativePath: pageData.relativePath,
		});
	},
	transformPageData(pageData) {
		if (pageData.relativePath === 'index.md') {
			pageData.frontmatter.hero = {
				...pageData.frontmatter.hero,
				name: identity.title,
				text: identity.motto.en,
				tagline: identity.description.en,
			};
		}
	},
	base,
	themeConfig: {
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Features', link: '/features/needs_you' },
			{ text: 'Documentation', link: '/documentation/' },
			{ text: 'About', link: '/about' },
		],
		sidebar: [
			{
				text: 'Features',
				items: [
					{ text: 'The Needs you sidebar section', link: '/features/needs_you' },
					{ text: 'The panes', link: '/features/panes' },
					{ text: 'The quotas and the usage wheel', link: '/features/quotas' },
					{ text: 'The phone access', link: '/features/phone_access' },
					{ text: 'The sidebar sections', link: '/features/sidebar_sections' },
					{ text: 'The Past chats sidebar section', link: '/features/past_chats' },
					{ text: 'The Statistics window', link: '/features/statistics' },
					{ text: 'The use of AI', link: '/features/ai' },
				],
			},
			{
				text: 'Documentation',
				items: [
					{ text: 'Introduction', link: '/documentation/' },
					{ text: 'Keyboard shortcuts', link: '/documentation/shortcuts' },
				],
			},
		],
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/heidrun-org/heidrun_code' },
		],
	},
});
