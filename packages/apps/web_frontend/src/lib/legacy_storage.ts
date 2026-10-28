// Copies the browser storage entries written under the former name "Herdr Desk" to the keys named "Heidrun Code".
// Imported first in main.ts, so it runs before the stores read their keys.

const LEGACY_PREFIX = "herdr-desk.";
const CURRENT_PREFIX = "heidrun.";

export class LegacyStorage {
  /** Moves every `herdr-desk.*` entry to `heidrun.*`, unless the new key already exists. */
  static migrate(): void {
    try {
      const legacyKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null && key.startsWith(LEGACY_PREFIX)) {
          legacyKeys.push(key);
        }
      }
      for (const key of legacyKeys) {
        const currentKey = CURRENT_PREFIX + key.slice(LEGACY_PREFIX.length);
        const value = localStorage.getItem(key);
        if (value !== null && localStorage.getItem(currentKey) === null) {
          localStorage.setItem(currentKey, value);
        }
        localStorage.removeItem(key);
      }
    } catch {
      /* storage unavailable: nothing to migrate */
    }
  }
}

LegacyStorage.migrate();
