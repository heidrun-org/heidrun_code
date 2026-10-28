import { vi } from "vitest";

// `vi.waitFor` checks again every 50 milliseconds by default, and the test sleeps between two checks. A check every 2
// milliseconds lets the tests that wait for a mocked call finish sooner (issue 826).
const WAIT_FOR_INTERVAL_MILLISECONDS = 2;
const originalWaitFor = vi.waitFor.bind(vi);

vi.waitFor = ((callback, options) => {
  const waitForOptions = typeof options === "number" ? { timeout: options } : options;
  return originalWaitFor(callback, { interval: WAIT_FOR_INTERVAL_MILLISECONDS, ...waitForOptions });
}) as typeof vi.waitFor;
