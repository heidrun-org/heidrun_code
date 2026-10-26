// @vitest-environment node
import { describe, expect, it } from "vitest";
import { highlightFile, highlightLine, languageFor } from "./highlight";

describe("languageFor", () => {
  it("finds the language from the extension", () => {
    expect(languageFor("src/app.ts")).toBe("typescript");
    expect(languageFor("a/b/main.rs")).toBe("rust");
    expect(languageFor("style.scss")).toBe("scss");
    expect(languageFor("App.vue")).toBe("xml");
    expect(languageFor("config.yml")).toBe("yaml");
  });

  it("ignores the letter case", () => {
    expect(languageFor("README.MD")).toBe("markdown");
  });

  it("knows special file names", () => {
    expect(languageFor("Dockerfile")).toBe("dockerfile");
    expect(languageFor("Dockerfile.dev")).toBe("dockerfile");
    expect(languageFor("Makefile")).toBe("makefile");
    expect(languageFor(".env.local")).toBe("bash");
  });

  it("returns null for an unknown extension", () => {
    expect(languageFor("photo.xyz")).toBeNull();
    expect(languageFor("noextension")).toBeNull();
  });
});

describe("highlightLine", () => {
  it("escapes HTML when there is no language", () => {
    expect(highlightLine("<a & b>", null)).toBe("&lt;a &amp; b&gt;");
  });

  it("returns an empty string for an empty text", () => {
    expect(highlightLine("", "rust")).toBe("");
  });

  it("wraps tokens in spans", () => {
    expect(highlightLine("const x = 1;", "javascript")).toContain("hljs-keyword");
  });
});

describe("highlightFile", () => {
  it("returns one entry per line", () => {
    expect(highlightFile("a\nb\nc", null)).toHaveLength(3);
  });

  it("closes and reopens spans across a multi-line comment", () => {
    const lines = highlightFile("/* one\ntwo */\nlet x = 1;", "javascript");
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect((line.match(/<span/g) ?? []).length).toBe((line.match(/<\/span>/g) ?? []).length);
    }
    expect(lines[1]).toContain("hljs-comment");
  });

  it("escapes HTML without a language", () => {
    expect(highlightFile("<div>", null)).toEqual(["&lt;div&gt;"]);
  });
});
