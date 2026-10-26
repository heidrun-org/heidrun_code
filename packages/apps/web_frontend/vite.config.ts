import Fs from "node:fs";
import Path from "node:path";
import Url from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { formatBuildTime } from "./src/lib/build_time";

const __filename = Url.fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

/** The name that `src/i18n/index.ts` imports to get the texts of every language. */
const LOCALE_MESSAGES_MODULE_ID = "virtual:locale-messages";

/**
 * Gives one module with the texts of every language, built from the files `src/i18n/locales/<language>/<namespace>.json`.
 * The key of a text is "<namespace>.<key in the file>". One module loads faster than the 202 modules of the JSON files:
 * a test that calls `vi.resetModules()` loads the texts again, and it did this 202 times for each test (issue 826).
 *
 * @returns The Vite plugin.
 */
function localeMessagesPlugin(): Plugin {
  const resolvedModuleId = "\0" + LOCALE_MESSAGES_MODULE_ID;
  const localesFolder = Path.join(__dirname, "src/i18n/locales");
  return {
    name: "locale-messages",
    resolveId(id) {
      return id === LOCALE_MESSAGES_MODULE_ID ? resolvedModuleId : null;
    },
    load(id) {
      if (id !== resolvedModuleId) {
        return null;
      }
      const messages: Record<string, Record<string, string>> = {};
      for (const language of Fs.readdirSync(localesFolder).sort()) {
        messages[language] = {};
        for (const fileName of Fs.readdirSync(Path.join(localesFolder, language)).sort()) {
          if (fileName.endsWith(".json") === false) {
            continue;
          }
          const filePath = Path.join(localesFolder, language, fileName);
          this.addWatchFile(filePath);
          const namespace = fileName.slice(0, -".json".length);
          const texts: Record<string, string> = JSON.parse(Fs.readFileSync(filePath, "utf8"));
          for (const [key, text] of Object.entries(texts)) {
            messages[language][namespace + "." + key] = text;
          }
        }
      }
      return "export default " + JSON.stringify(messages) + ";";
    },
  };
}

// Tauri expects a fixed port and does not want Vite to clear its output.
export default defineConfig({
  plugins: [vue(), localeMessagesPlugin()],
  clearScreen: false,
  // The date and time of the build, for the window "About Heidrun Code". In development, it is the start of the dev server.
  define: {
    __BUILD_TIME__: JSON.stringify(formatBuildTime(new Date())),
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
        quietDeps: true,
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/desktop_tauri/**"] },
  },
  test: {
    // happy-dom starts faster than jsdom. The files that need jsdom start with the line `// @vitest-environment jsdom` (issue 826).
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test_setup.ts"],
    // The first test of a file that mounts App.vue loads the whole window, and it needs more than 5 seconds when `pnpm test` runs all the packages together.
    testTimeout: 30000,
  },
  build: {
    target: "safari16",
    sourcemap: false,
  },
});
