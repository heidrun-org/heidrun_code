import { defineConfig } from 'vitest/config';
import { DistSyncPlugin } from './build_tools/dist_sync_plugin';
import { DevServerPlugin } from './dev/dev_server_plugin';

// `pnpm --filter mobile_website dev` answers `/api` with a fake computer. With `MOBILE_API_TARGET` set to the address
// of the mobile server of the desktop application, it sends `/api` to the real application instead. The real
// application accepts only the host name of its ngrok tunnel: give it in `MOBILE_API_HOST`.
export default defineConfig({
	plugins: [
		DevServerPlugin.create(process.env.MOBILE_API_TARGET ?? null, process.env.MOBILE_API_HOST ?? null),
		DistSyncPlugin.create(import.meta.dirname),
	],
	server: {
		host: '127.0.0.1',
		port: 5183,
		strictPort: true,
	},
	build: {
		// The page must run on Safari 16 or later, the oldest browser engine of the phones that it supports.
		target: 'safari16',
		// Vite writes into a staging folder, and `DistSyncPlugin` copies into `dist` only the files that changed, so an
		// unchanged build does not make Cargo compile the mobile server and the application again.
		outDir: DistSyncPlugin.stagingFolderName,
		emptyOutDir: true,
		sourcemap: false,
		// The page runs under a content security policy that allows only files of its own address: no inline
		// script.
		modulePreload: {
			polyfill: false,
		},
	},
	test: {
		environment: 'jsdom',
		include: ['tests/**/*.test.ts'],
		setupFiles: ['tests/setup.ts'],
	},
});
