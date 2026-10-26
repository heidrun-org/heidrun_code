// Keeps a copy of the `localStorage` entries of Heidrun Code in the data folder of Heidrun Code, and restores the entries that are missing.
// The web view keeps `localStorage` in a folder named after the application identifier, so a change of the identifier
// shows an empty `localStorage` and every option returns to its default value (issue 772). main.ts restores before the
// stores read their keys, then starts the copy.

import { invoke } from "@tauri-apps/api/core";

const KEY_PREFIX = "heidrun.";
const WRITE_DELAY_MILLISECONDS = 300;

type StorageMethods = {
  setItem: Storage["setItem"];
  removeItem: Storage["removeItem"];
  clear: Storage["clear"];
};

export class DurableStorage {
  private static _originalMethods: StorageMethods | null = null;
  private static _writeTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly _onPageHide = (): void => {
    void DurableStorage.flush();
  };

  /**
   * Fills each entry of Heidrun Code that `localStorage` lacks. The entries come from the copy in the data folder. When the copy does
   * not exist yet, they come from the web view storage of the former application identifier, once, at the first start after
   * the update. An entry that `localStorage` holds is never replaced.
   * @returns A promise that resolves when the entries are restored. It never rejects: without a copy, nothing is restored.
   */
  static async restore(): Promise<void> {
    try {
      const copy = await invoke<Record<string, string> | null>("durable_storage_read");
      const entries = copy ?? (await invoke<Record<string, string>>("former_web_view_storage_read"));
      for (const [key, value] of Object.entries(entries)) {
        if (key.startsWith(KEY_PREFIX) && typeof value === "string" && localStorage.getItem(key) === null) {
          localStorage.setItem(key, value);
        }
      }
    } catch {
      /* the copy cannot be read: the stores start from `localStorage` alone */
    }
  }

  /**
   * Writes the first copy, then writes the copy again after each change of an entry of `localStorage`. Call it once, after
   * `restore`: a copy written before the restore would replace the saved entries with an empty `localStorage`.
   */
  static startMirroring(): void {
    if (DurableStorage._originalMethods !== null) {
      return;
    }
    const prototype = Storage.prototype;
    const original: StorageMethods = {
      setItem: prototype.setItem,
      removeItem: prototype.removeItem,
      clear: prototype.clear,
    };
    DurableStorage._originalMethods = original;
    prototype.setItem = function (this: Storage, key: string, value: string): void {
      original.setItem.call(this, key, value);
      DurableStorage._scheduleWrite(this);
    };
    prototype.removeItem = function (this: Storage, key: string): void {
      original.removeItem.call(this, key);
      DurableStorage._scheduleWrite(this);
    };
    prototype.clear = function (this: Storage): void {
      original.clear.call(this);
      DurableStorage._scheduleWrite(this);
    };
    window.addEventListener("pagehide", DurableStorage._onPageHide);
    DurableStorage._scheduleWrite(localStorage);
  }

  /** Stops the copy and gives the original methods back to `Storage`. The tests use it. */
  static stopMirroring(): void {
    const original = DurableStorage._originalMethods;
    if (original === null) {
      return;
    }
    Storage.prototype.setItem = original.setItem;
    Storage.prototype.removeItem = original.removeItem;
    Storage.prototype.clear = original.clear;
    DurableStorage._originalMethods = null;
    window.removeEventListener("pagehide", DurableStorage._onPageHide);
    if (DurableStorage._writeTimer !== null) {
      clearTimeout(DurableStorage._writeTimer);
      DurableStorage._writeTimer = null;
    }
  }

  /**
   * Writes the copy now when a write is waiting, instead of after the delay.
   * @returns A promise that resolves when the write ends.
   */
  static async flush(): Promise<void> {
    if (DurableStorage._writeTimer === null) {
      return;
    }
    clearTimeout(DurableStorage._writeTimer);
    DurableStorage._writeTimer = null;
    await DurableStorage._write();
  }

  /**
   * Plans one write after a short delay: many changes in a row give one write.
   * @param storage - The storage that changed. Only `localStorage` is copied.
   */
  private static _scheduleWrite(storage: Storage): void {
    if (storage !== localStorage || DurableStorage._writeTimer !== null) {
      return;
    }
    DurableStorage._writeTimer = setTimeout(() => {
      DurableStorage._writeTimer = null;
      void DurableStorage._write();
    }, WRITE_DELAY_MILLISECONDS);
  }

  private static async _write(): Promise<void> {
    const entries: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      const value = key === null ? null : localStorage.getItem(key);
      if (key !== null && key.startsWith(KEY_PREFIX) && value !== null) {
        entries[key] = value;
      }
    }
    try {
      await invoke("durable_storage_write", { entries });
    } catch {
      /* the next change writes the copy again */
    }
  }
}
