// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRefitHold } from "./refit_hold";

const QUIET_MS = 120;
const MAX_MS = 500;

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function setup() {
  const calls: string[] = [];
  const sizes: [number, number][] = [];
  const hold = createRefitHold({
    terminal: {
      write: (data, callback) => {
        calls.push(`write ${typeof data === "string" ? JSON.stringify(data) : new TextDecoder().decode(data)}`);
        callback?.();
      },
      resize: (cols, rows) => {
        calls.push(`resize ${cols}x${rows}`);
      },
    },
    sendSize: (cols, rows) => {
      sizes.push([cols, rows]);
    },
    quietMs: QUIET_MS,
    maxMs: MAX_MS,
  });
  return { hold, calls, sizes };
}

describe("createRefitHold", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tells Herdr the new size at once, and leaves the terminal as it is", () => {
    const { hold, calls, sizes } = setup();
    hold.start(130, 30);
    expect(sizes).toEqual([[130, 30]]);
    expect(calls).toEqual([]);
    expect(hold.isBusy()).toBe(true);
  });

  it("does not hold the output when no change of size is waiting", () => {
    const { hold } = setup();
    expect(hold.hold(bytes("a"))).toBe(false);
    expect(hold.isBusy()).toBe(false);
  });

  it("holds the output, then clears the screen, resizes, and writes the held output once, in order", () => {
    const { hold, calls } = setup();
    hold.start(130, 30);
    expect(hold.hold(bytes("first "))).toBe(true);
    expect(hold.hold(bytes("second"))).toBe(true);
    vi.advanceTimersByTime(QUIET_MS - 1);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['write "\\u001b[2J\\u001b[H"', "resize 130x30", "write first second"]);
    expect(hold.isBusy()).toBe(false);
  });

  it("waits longer while the output goes on", () => {
    const { hold, calls } = setup();
    hold.start(130, 30);
    for (let step = 0; step < 4; step++) {
      hold.hold(bytes("x"));
      vi.advanceTimersByTime(QUIET_MS - 20);
    }
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(20);
    expect(calls).toContain("resize 130x30");
  });

  it("takes the new size after the longest wait, even when the output never stops", () => {
    const { hold, calls } = setup();
    hold.start(130, 30);
    for (let elapsed = 0; elapsed < MAX_MS; elapsed += 50) {
      hold.hold(bytes("x"));
      vi.advanceTimersByTime(50);
    }
    expect(calls).toContain("resize 130x30");
    expect(hold.isBusy()).toBe(false);
  });

  it("takes the new size after the longest wait, when Herdr sends nothing", () => {
    const { hold, calls } = setup();
    hold.start(130, 30);
    vi.advanceTimersByTime(MAX_MS - 1);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['write "\\u001b[2J\\u001b[H"', "resize 130x30"]);
  });

  it("ignores a second start while busy", () => {
    const { hold, sizes } = setup();
    hold.start(130, 30);
    hold.start(90, 20);
    expect(sizes).toEqual([[130, 30]]);
  });

  it("gives the terminal the new size at once on cancel, and drops the held output", () => {
    const { hold, calls } = setup();
    hold.start(130, 30);
    hold.hold(bytes("old"));
    hold.cancel();
    expect(calls).toEqual(["resize 130x30"]);
    expect(hold.isBusy()).toBe(false);
    vi.advanceTimersByTime(MAX_MS * 2);
    expect(calls).toEqual(["resize 130x30"]);
  });

  it("does nothing on cancel when no change of size is waiting", () => {
    const { hold, calls } = setup();
    hold.cancel();
    expect(calls).toEqual([]);
  });
});
