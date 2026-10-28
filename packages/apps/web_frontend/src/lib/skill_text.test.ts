// @vitest-environment node
import { describe, expect, it } from "vitest";
import { splitSkillText } from "./skill_text";

describe("splitSkillText", () => {
  it("cuts the frontmatter fields from the Markdown text", () => {
    const result = splitSkillText("---\nname: pdf\ndescription: Read PDF files.\n---\n\n# PDF\n\nText");
    expect(result.fields).toEqual([
      { key: "name", value: "pdf" },
      { key: "description", value: "Read PDF files." },
    ]);
    expect(result.body).toBe("# PDF\n\nText");
  });

  it("removes the quotes around a value", () => {
    const result = splitSkillText("---\ndescription: 'Generate a server'\nname: \"x\"\n---\nBody");
    expect(result.fields).toEqual([
      { key: "description", value: "Generate a server" },
      { key: "name", value: "x" },
    ]);
  });

  it("keeps a colon inside a value", () => {
    expect(splitSkillText("---\ndescription: Use when: a file is a PDF\n---\n").fields[0].value).toBe("Use when: a file is a PDF");
  });

  it("joins the continuation lines of a long value", () => {
    const result = splitSkillText("---\ndescription: First part\n  second part\nname: x\n---\nBody");
    expect(result.fields).toEqual([
      { key: "description", value: "First part second part" },
      { key: "name", value: "x" },
    ]);
  });

  it("accepts Windows line ends and a mark of byte order", () => {
    const result = splitSkillText("﻿---\r\nname: x\r\n---\r\nBody");
    expect(result.fields).toEqual([{ key: "name", value: "x" }]);
    expect(result.body).toBe("Body");
  });

  it("returns the whole text when there is no frontmatter", () => {
    expect(splitSkillText("# Title\n\nText")).toEqual({ fields: [], body: "# Title\n\nText" });
  });

  it("returns the whole text when the frontmatter is not closed", () => {
    expect(splitSkillText("---\nname: x\n# Title").fields).toEqual([]);
  });
});
