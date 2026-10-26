// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { copy, writeToClipboard } from "./clipboard";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: vi.fn() }));

/** Replaces the clipboard of the browser, or removes it with `undefined`. */
function setBrowserClipboard(clipboard: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
}

describe("writeToClipboard (issue #803)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    setBrowserClipboard(undefined);
  });

  it("writes through Tauri", async () => {
    await writeToClipboard("ls -la");
    expect(writeText).toHaveBeenCalledWith("ls -la");
  });

  it("writes through the browser when Tauri fails", async () => {
    vi.mocked(writeText).mockRejectedValueOnce(new Error("no Tauri"));
    const browserWrite = vi.fn(async () => {});
    setBrowserClipboard({ writeText: browserWrite });
    await writeToClipboard("ls -la");
    expect(browserWrite).toHaveBeenCalledWith("ls -la");
  });

  it("rejects when Tauri and the browser both fail, so that the copy tells the developer", async () => {
    vi.mocked(writeText).mockRejectedValueOnce(new Error("no Tauri"));
    setBrowserClipboard({ writeText: async () => Promise.reject(new Error("refused")) });
    await expect(writeToClipboard("ls -la")).rejects.toThrow("refused");
  });

  it("rejects when Tauri fails and the browser has no clipboard", async () => {
    vi.mocked(writeText).mockRejectedValueOnce(new Error("no Tauri"));
    await expect(writeToClipboard("ls -la")).rejects.toThrow("no Tauri");
  });

  it("rejects an empty text, which would leave the clipboard unchanged", async () => {
    await expect(writeToClipboard("")).rejects.toThrow("Nothing to copy");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("keeps copy silent for its other callers", async () => {
    vi.mocked(writeText).mockRejectedValueOnce(new Error("no Tauri"));
    await expect(copy("ls -la")).resolves.toBeUndefined();
  });
});
