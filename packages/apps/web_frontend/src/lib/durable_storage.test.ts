// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DurableStorage } from "./durable_storage";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

type Answers = {
  copy?: Record<string, string> | null | Error;
  former?: Record<string, string> | Error;
};

/** Answers the three Tauri commands of the durable storage, and records every write. */
function answer({ copy = null, former = {} }: Answers): Array<Record<string, string>> {
  const writes: Array<Record<string, string>> = [];
  invoke.mockImplementation(async (command: string, payload?: { entries: Record<string, string> }) => {
    if (command === "durable_storage_read") {
      if (copy instanceof Error) {
        throw copy;
      }
      return copy;
    }
    if (command === "former_web_view_storage_read") {
      if (former instanceof Error) {
        throw former;
      }
      return former;
    }
    if (command === "durable_storage_write") {
      writes.push(payload?.entries ?? {});
      return null;
    }
    throw new Error(`unexpected command ${command}`);
  });
  return writes;
}

function lastWrite(writes: Array<Record<string, string>>): Record<string, string> | undefined {
  return writes[writes.length - 1];
}

beforeEach(() => {
  localStorage.clear();
  invoke.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  DurableStorage.stopMirroring();
  vi.useRealTimers();
});

describe("DurableStorage.restore", () => {
  it("restores an entry that localStorage lacks from the copy", async () => {
    answer({ copy: { "heidrun.settings": "{\"fontSize\":18}" } });
    await DurableStorage.restore();
    expect(localStorage.getItem("heidrun.settings")).toBe("{\"fontSize\":18}");
  });

  it("never replaces an entry that localStorage holds", async () => {
    answer({ copy: { "heidrun.settings": "old", "heidrun.notes": "[]" } });
    localStorage.setItem("heidrun.settings", "new");
    await DurableStorage.restore();
    expect(localStorage.getItem("heidrun.settings")).toBe("new");
    expect(localStorage.getItem("heidrun.notes")).toBe("[]");
  });

  it("reads the former web view storage when the copy does not exist yet", async () => {
    answer({ copy: null, former: { "heidrun.settings": "{\"leftWidth\":333}" } });
    await DurableStorage.restore();
    expect(localStorage.getItem("heidrun.settings")).toBe("{\"leftWidth\":333}");
    expect(invoke).toHaveBeenCalledWith("former_web_view_storage_read");
  });

  it("does not read the former web view storage when the copy exists", async () => {
    answer({ copy: { "heidrun.notes": "[]" }, former: { "heidrun.settings": "former" } });
    await DurableStorage.restore();
    expect(invoke).not.toHaveBeenCalledWith("former_web_view_storage_read");
    expect(localStorage.getItem("heidrun.settings")).toBeNull();
  });

  it("restores only the entries of Heidrun Code, and only text values", async () => {
    answer({ copy: { "other.key": "x", "heidrun.number": 4 as unknown as string, "heidrun.ok": "1" } });
    await DurableStorage.restore();
    expect(localStorage.getItem("other.key")).toBeNull();
    expect(localStorage.getItem("heidrun.number")).toBeNull();
    expect(localStorage.getItem("heidrun.ok")).toBe("1");
  });

  it("keeps localStorage as it is when the copy cannot be read", async () => {
    answer({ copy: new Error("no bridge") });
    localStorage.setItem("heidrun.settings", "kept");
    await expect(DurableStorage.restore()).resolves.toBeUndefined();
    expect(localStorage.getItem("heidrun.settings")).toBe("kept");
  });

  it("keeps localStorage as it is when the former web view storage cannot be read", async () => {
    answer({ copy: null, former: new Error("sqlite3 failed") });
    await expect(DurableStorage.restore()).resolves.toBeUndefined();
    expect(localStorage.length).toBe(0);
  });
});

describe("DurableStorage.startMirroring", () => {
  it("writes the first copy with the entries of Heidrun Code only", async () => {
    const writes = answer({});
    localStorage.setItem("heidrun.settings", "a");
    localStorage.setItem("other.key", "b");
    DurableStorage.startMirroring();
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toEqual([{ "heidrun.settings": "a" }]);
  });

  it("writes once for many changes in a row, with the last values", async () => {
    const writes = answer({});
    DurableStorage.startMirroring();
    await vi.advanceTimersByTimeAsync(1000);
    writes.length = 0;
    localStorage.setItem("heidrun.settings", "1");
    localStorage.setItem("heidrun.settings", "2");
    localStorage.setItem("heidrun.notes", "n");
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toEqual([{ "heidrun.settings": "2", "heidrun.notes": "n" }]);
  });

  it("writes the copy again after a removal and after a clear", async () => {
    const writes = answer({});
    localStorage.setItem("heidrun.a", "1");
    localStorage.setItem("heidrun.b", "2");
    DurableStorage.startMirroring();
    await vi.advanceTimersByTimeAsync(1000);
    localStorage.removeItem("heidrun.a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(lastWrite(writes)).toEqual({ "heidrun.b": "2" });
    localStorage.clear();
    await vi.advanceTimersByTimeAsync(1000);
    expect(lastWrite(writes)).toEqual({});
  });

  it("does not write for a change of sessionStorage", async () => {
    const writes = answer({});
    DurableStorage.startMirroring();
    await vi.advanceTimersByTimeAsync(1000);
    writes.length = 0;
    sessionStorage.setItem("heidrun.session", "x");
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toEqual([]);
    sessionStorage.clear();
  });

  it("still stores the value in localStorage, and survives a write that fails", async () => {
    answer({});
    invoke.mockImplementation(async () => {
      throw new Error("disk full");
    });
    DurableStorage.startMirroring();
    localStorage.setItem("heidrun.settings", "kept");
    await vi.advanceTimersByTimeAsync(1000);
    expect(localStorage.getItem("heidrun.settings")).toBe("kept");
  });

  it("starts only once", async () => {
    const writes = answer({});
    DurableStorage.startMirroring();
    DurableStorage.startMirroring();
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes.length).toBe(1);
  });

  it("writes at once on flush when a write waits, and does nothing when no write waits", async () => {
    const writes = answer({});
    DurableStorage.startMirroring();
    await vi.advanceTimersByTimeAsync(1000);
    writes.length = 0;
    await DurableStorage.flush();
    expect(writes).toEqual([]);
    localStorage.setItem("heidrun.settings", "last");
    await DurableStorage.flush();
    expect(writes).toEqual([{ "heidrun.settings": "last" }]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes.length).toBe(1);
  });
});

describe("the whole update", () => {
  it("brings the options of the former identifier back, then keeps them across a start with an empty localStorage", async () => {
    const saved = JSON.stringify({ fontSize: 20, leftWidth: 333 });
    answer({ copy: null, former: { "heidrun.settings": saved } });
    await DurableStorage.restore();
    expect(localStorage.getItem("heidrun.settings")).toBe(saved);

    const writes = answer({ copy: null });
    DurableStorage.startMirroring();
    await vi.advanceTimersByTimeAsync(1000);
    expect(lastWrite(writes)).toEqual({ "heidrun.settings": saved });
    DurableStorage.stopMirroring();

    localStorage.clear();
    answer({ copy: lastWrite(writes) });
    await DurableStorage.restore();
    expect(localStorage.getItem("heidrun.settings")).toBe(saved);
  });
});
