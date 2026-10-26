// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));

const { ApplicationLog } = await import("./application_log");

describe("ApplicationLog.recordLoadTime", () => {
	beforeEach(() => {
		invokeMock.mockReset();
	});

	it("sends the part, the duration in whole milliseconds, and the failure to the Tauri command", async () => {
		invokeMock.mockResolvedValue(undefined);
		const startedAt = performance.now() - 120.4;
		await ApplicationLog.recordLoadTime("past_chats", startedAt, "no folder");
		expect(invokeMock).toHaveBeenCalledTimes(1);
		const [command, args] = invokeMock.mock.calls[0] as [string, { part: string; durationMs: number; error: string | null }];
		expect(command).toBe("application_log_load_time");
		expect(args.part).toBe("past_chats");
		expect(Number.isInteger(args.durationMs)).toBe(true);
		expect(args.durationMs).toBeGreaterThanOrEqual(120);
		expect(args.error).toBe("no folder");
	});

	it("never fails when the application log cannot be written", async () => {
		invokeMock.mockRejectedValue(new Error("no Tauri"));
		await expect(ApplicationLog.recordLoadTime("statistics_ai_cost", performance.now(), null)).resolves.toBeUndefined();
	});
});
