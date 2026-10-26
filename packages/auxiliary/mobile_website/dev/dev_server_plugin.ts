import Fs from 'node:fs';
import Http from 'node:http';
import Os from 'node:os';
import Path from 'node:path';
import type { Plugin, ProxyOptions, UserConfig, ViteDevServer } from 'vite';
import { DevApi } from './dev_api';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DevServerPlugin — answers `/api` in the development server, with a fake computer or the real application
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The plugin of the development server of the mobile website. It works only for `vite` (the command `serve`), never
 * for `vite build`, so nothing of this folder reaches the built website.
 */
export class DevServerPlugin {
	/** The biggest body of a call that the fake computer accepts, in bytes. */
	private static readonly maxBodyBytes = 64 * 1024;

	/**
	 * Builds the plugin.
	 * @param realTarget The address of the mobile server of the desktop application, for example
	 * `http://127.0.0.1:47823`, or null to answer with the fake computer.
	 * @param tunnelHost The host name of the ngrok tunnel of the desktop application, for example
	 * `words-of-the-tunnel.ngrok-free.dev`, or null. The mobile server accepts no other host name, so the proxy sends
	 * this one in the headers `Host` and `Origin`.
	 * @returns The plugin.
	 */
	static create(realTarget: string | null, tunnelHost: string | null = null): Plugin {
		const devApi = new DevApi();
		return {
			name: 'mobile-website-dev-api',
			apply: 'serve',
			config() {
				return realTarget === null ? {} : DevServerPlugin.proxyConfig(realTarget, tunnelHost);
			},
			configureServer(server) {
				if (realTarget === null) {
					server.middlewares.use('/api', (request, response) => {
						void DevServerPlugin.answer(devApi, request, response);
					});
				}
				const printUrls = server.printUrls.bind(server);
				server.printUrls = () => {
					printUrls();
					DevServerPlugin.printPairedAddress(server, realTarget);
				};
			},
		};
	}

	private static proxyConfig(realTarget: string, tunnelHost: string | null): UserConfig {
		const apiProxy: ProxyOptions = {
			target: realTarget,
			changeOrigin: true,
			configure: (proxy) => {
				proxy.on('proxyReq', (proxyRequest) => {
					// The mobile server refuses a host and an origin that are not the ones of its tunnel.
					if (tunnelHost === null) {
						proxyRequest.setHeader('origin', realTarget);
						return;
					}
					proxyRequest.setHeader('host', tunnelHost);
					proxyRequest.setHeader('origin', `https://${tunnelHost}`);
				});
			},
		};
		return {
			server: {
				proxy: {
					'/api': apiProxy,
				},
			},
		};
	}

	private static async answer(
		devApi: DevApi,
		request: Http.IncomingMessage,
		response: Http.ServerResponse,
	): Promise<void> {
		if (request.method !== 'POST') {
			response.statusCode = 405;
			response.end('POST only');
			return;
		}
		const chunks: Buffer[] = [];
		let size = 0;
		for await (const chunk of request) {
			size += (chunk as Buffer).length;
			if (size > DevServerPlugin.maxBodyBytes) {
				response.statusCode = 413;
				response.end('Request too large');
				return;
			}
			chunks.push(chunk as Buffer);
		}
		const header = request.headers['x-herdr-token'];
		const body = Buffer.concat(chunks).toString('utf8');
		const reply = devApi.handle(typeof header === 'string' ? header : null, body);
		response.statusCode = reply.status;
		response.setHeader('content-type', typeof reply.body === 'string' ? 'text/plain' : 'application/json');
		response.setHeader('cache-control', 'no-store');
		response.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body));
	}

	/**
	 * Gives the lines that the development server prints to pair a browser: one address for each way to reach the
	 * server, with the pairing key after the sign "#". The network address is there only when Vite runs with
	 * `--host`.
	 * @param addresses The addresses of the server: the local one first, then the ones of the network.
	 * @param realTarget The address of the mobile server of the desktop application, or null for the fake computer.
	 * @param realKey The pairing key of the desktop application, or null when it has none.
	 * @returns The lines to print.
	 */
	static pairingLines(addresses: string[], realTarget: string | null, realKey: string | null): string[] {
		const key = realTarget === null ? DevApi.pairingKey : realKey;
		const title = realTarget === null ? 'Fake computer' : `Real desktop application at ${realTarget}`;
		const lines: string[] = [];
		for (const address of addresses) {
			lines.push(`  ➜  ${title}: open ${address}${key === null ? '' : `#t=${key}`}`);
		}
		if (key === null) {
			lines.push('     The file mobile.json has no pairing key: turn the mobile access on first.');
		}
		return lines;
	}

	private static printPairedAddress(server: ViteDevServer, realTarget: string | null): void {
		const local = server.resolvedUrls?.local ?? ['http://127.0.0.1:5183/'];
		const network = server.resolvedUrls?.network ?? [];
		const realKey = realTarget === null ? null : DevServerPlugin.readRealPairingKey();
		const addresses = [...local.slice(0, 1), ...network];
		for (const line of DevServerPlugin.pairingLines(addresses, realTarget, realKey)) {
			console.log(line);
		}
	}

	/**
	 * Gives `~/.config/heidrun_code`, or the former folder `~/.config/heidrun` when it exists and the new folder does not.
	 * @returns The folder that holds the file `mobile.json` when no environment variable names a folder.
	 */
	private static defaultDataFolder(): string {
		const current = Path.join(Os.homedir(), '.config', 'heidrun_code');
		const former = Path.join(Os.homedir(), '.config', 'heidrun');
		if (Fs.existsSync(current) === false && Fs.existsSync(former)) {
			return former;
		}
		return current;
	}

	private static readRealPairingKey(): string | null {
		const folder = process.env.HEIDRUN_CODE_DIR ?? process.env.HEIDRUN_DIR ?? DevServerPlugin.defaultDataFolder();
		try {
			const text = Fs.readFileSync(Path.join(folder, 'mobile.json'), 'utf8');
			const token = (JSON.parse(text) as { token?: unknown }).token;
			return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token) ? token : null;
		} catch {
			return null;
		}
	}
}
