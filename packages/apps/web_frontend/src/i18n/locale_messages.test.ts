// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import localeMessages from "virtual:locale-messages";

const LOCALES_DIR = path.join(import.meta.dirname, "locales");

describe("the module virtual:locale-messages", () => {
  it("has the languages of the folders of locales, and no other language", () => {
    expect(Object.keys(localeMessages).sort()).toEqual(fs.readdirSync(LOCALES_DIR).sort());
  });

  it("has every text of every JSON file, under the key <namespace>.<key in the file>, with the same text", () => {
    for (const language of fs.readdirSync(LOCALES_DIR)) {
      const expected: Record<string, string> = {};
      for (const fileName of fs.readdirSync(path.join(LOCALES_DIR, language))) {
        const texts: Record<string, string> = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, language, fileName), "utf8"));
        for (const [key, text] of Object.entries(texts)) {
          expected[`${fileName.replace(/\.json$/, "")}.${key}`] = text;
        }
      }
      expect(localeMessages[language]).toEqual(expected);
    }
  });
});
