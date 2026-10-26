// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BUSY_RETRY_LIMIT,
  EARLY_STOP_MS,
  HELD_RETRY_LIMIT,
  decideAfterStop,
  isHeldByAnotherClient,
  retryDelayMs,
} from "./terminal_attach_retry";

const REFUSAL =
  "herdr: server shut down: terminal attach failed: terminal term_65dd7d8aae7211 already has an attached client; retry with --takeover";
const BUSY = "herdr: terminal term_1 has a read in progress; retry";
const LATE = EARLY_STOP_MS + 1;

describe("isHeldByAnotherClient", () => {
  it("recognizes the refusal of Herdr", () => {
    expect(isHeldByAnotherClient(REFUSAL)).toBe(true);
  });

  it("does not take the busy text of Herdr for a refusal", () => {
    expect(isHeldByAnotherClient(BUSY)).toBe(false);
  });
});

describe("decideAfterStop", () => {
  it("does not start the six retries when another client holds the terminal", () => {
    expect(decideAfterStop(REFUSAL, 50, 0)).toBe("retry");
    expect(decideAfterStop(REFUSAL, 50, HELD_RETRY_LIMIT - 1)).toBe("retry");
    expect(decideAfterStop(REFUSAL, 50, HELD_RETRY_LIMIT)).toBe("held");
    expect(HELD_RETRY_LIMIT).toBeLessThan(BUSY_RETRY_LIMIT);
  });

  it("shows the refusal even when the attach client stopped after a long time", () => {
    expect(decideAfterStop(REFUSAL, LATE, HELD_RETRY_LIMIT)).toBe("held");
  });

  it("still retries when Herdr has a read in progress", () => {
    expect(decideAfterStop(BUSY, LATE, 0)).toBe("retry");
    expect(decideAfterStop(BUSY, LATE, BUSY_RETRY_LIMIT - 1)).toBe("retry");
    expect(decideAfterStop(BUSY, LATE, BUSY_RETRY_LIMIT)).toBe("detached");
  });

  it("still retries when the attach client stops at once without a known text", () => {
    expect(decideAfterStop("", 100, 0)).toBe("retry");
    expect(decideAfterStop("", 100, BUSY_RETRY_LIMIT)).toBe("detached");
  });

  it("does not retry when the attach client stops late without a known text", () => {
    expect(decideAfterStop("", LATE, 0)).toBe("detached");
  });
});

describe("retryDelayMs", () => {
  it("grows with each retry", () => {
    expect(retryDelayMs(BUSY, 1)).toBe(250);
    expect(retryDelayMs(BUSY, 3)).toBe(750);
  });

  it("waits longer than 400 milliseconds before the first retry when another client holds the terminal", () => {
    expect(retryDelayMs(REFUSAL, 1)).toBeGreaterThan(400);
    expect(retryDelayMs(REFUSAL, 2)).toBeGreaterThan(retryDelayMs(REFUSAL, 1));
  });
});
