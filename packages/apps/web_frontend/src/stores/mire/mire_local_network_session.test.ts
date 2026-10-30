import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn(async (): Promise<unknown> => null);

vi.mock('@tauri-apps/api/core', () => ({
	invoke: () => invoke(),
}));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async () => () => {}),
}));
vi.mock('@tauri-apps/api/path', () => ({
	homeDir: vi.fn(async () => '/home'),
}));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({
		setZoom: vi.fn(async () => {}),
	}),
}));

import { state as sessionState } from '../session';
import { MireViewTestSupport } from '../../components/mire/mire_view_test_support';
import { MIRE_LOCAL_NETWORK_STATE_PATH, MireLocalNetworkSession, mireLocalNetworkPageState } from './mire_local_network_session';
import { MireStore, MireViewConnection, mireState } from './mire_store';

/** The answer of the fake Mire server. */
function answer(): Response {
	return new Response(JSON.stringify({
		snapshot: MireViewTestSupport.snapshot(),
		observations: MireViewTestSupport.observations(),
		herdrSocketPath: '/home/.config/herdr/sessions/heidrun/herdr.sock',
	}), {
		status: 200,
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	invoke.mockClear();
	MireStore.useDisplayMode('localNetwork');
});

afterEach(() => {
	MireLocalNetworkSession.stop();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	sessionState.snapshot = null;
	mireState.observations = null;
	mireLocalNetworkPageState.isConnectionLost = false;
	MireStore.useDisplayMode('modal');
});

describe('MireLocalNetworkSession (issue 978)', () => {
	it('reads the state from the Mire server with the cookie of the key, and keeps the snapshot, the observations, and the session', async () => {
		const fetchFn = vi.fn(async () => answer());
		vi.stubGlobal('fetch', fetchFn);
		expect(await MireLocalNetworkSession.read()).toBe(true);
		expect(fetchFn).toHaveBeenCalledWith(MIRE_LOCAL_NETWORK_STATE_PATH, {
			cache: 'no-store',
			credentials: 'same-origin',
		});
		expect(sessionState.snapshot?.workspaces.length).toBeGreaterThan(0);
		expect(sessionState.connected).toBe(true);
		expect(mireState.observations).not.toBe(null);
		expect(mireState.herdrSessionName).toBe('heidrun');
		expect(invoke).not.toHaveBeenCalled();
	});

	it('marks the connection as lost after a refused or failed reading', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('Pairing needed', {
			status: 401,
		})));
		expect(await MireLocalNetworkSession.read()).toBe(false);
		expect(mireLocalNetworkPageState.isConnectionLost).toBe(true);
		expect(sessionState.connected).toBe(false);
		vi.stubGlobal('fetch', vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}));
		expect(await MireLocalNetworkSession.read()).toBe(false);
		expect(mireLocalNetworkPageState.isConnectionLost).toBe(true);
	});

	it('reads again every second after a success, and every three seconds after a failure, until the stop', async () => {
		const fetchFn = vi.fn(async () => answer());
		vi.stubGlobal('fetch', fetchFn);
		await MireLocalNetworkSession.start();
		expect(fetchFn).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(fetchFn).toHaveBeenCalledTimes(2);
		fetchFn.mockImplementation(async () => {
			throw new TypeError('Failed to fetch');
		});
		await vi.advanceTimersByTimeAsync(1_000);
		expect(fetchFn).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(2_000);
		expect(fetchFn).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(fetchFn).toHaveBeenCalledTimes(4);
		MireLocalNetworkSession.stop();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(fetchFn).toHaveBeenCalledTimes(4);
	});

	it('opens a Mire view on the page of a device without registering in the collector of the desktop application', async () => {
		const connection = new MireViewConnection();
		await connection.open();
		await connection.close();
		expect(invoke).not.toHaveBeenCalled();
	});
});
