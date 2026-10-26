// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trailingDebounce } from "./trailing_debounce";

describe("trailingDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not run before the delay is over", () => {
    const run = vi.fn();
    trailingDebounce(run, 300).call();
    vi.advanceTimersByTime(299);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs once, after the delay", () => {
    const run = vi.fn();
    trailingDebounce(run, 300).call();
    vi.advanceTimersByTime(300);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not run during a burst of calls, then runs once after the last call", () => {
    const run = vi.fn();
    const debounced = trailingDebounce(run, 300);
    for (let step = 0; step < 20; step++) {
      debounced.call();
      vi.advanceTimersByTime(100);
    }
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs again for a later burst", () => {
    const run = vi.fn();
    const debounced = trailingDebounce(run, 300);
    debounced.call();
    vi.advanceTimersByTime(300);
    debounced.call();
    vi.advanceTimersByTime(300);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not run after cancel", () => {
    const run = vi.fn();
    const debounced = trailingDebounce(run, 300);
    debounced.call();
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
  });
});
