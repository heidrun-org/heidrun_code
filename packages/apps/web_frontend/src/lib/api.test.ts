// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({ read: { text: "output" } })) }));

import { invoke } from "@tauri-apps/api/core";
import { read } from "./api";

describe("read", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear();
  });

  it("asks for plain text by default, without a format", async () => {
    await expect(read("p1", 40)).resolves.toBe("output");
    expect(invoke).toHaveBeenCalledWith("herdr_request", {
      method: "pane.read",
      params: {
        pane_id: "p1",
        source: "recent_unwrapped",
        lines: 40,
      },
    });
  });

  it("asks for the colors of the terminal with the format ansi", async () => {
    await read("p1", 40, "ansi");
    expect(invoke).toHaveBeenCalledWith("herdr_request", {
      method: "pane.read",
      params: {
        pane_id: "p1",
        source: "recent_unwrapped",
        lines: 40,
        format: "ansi",
      },
    });
  });
});
