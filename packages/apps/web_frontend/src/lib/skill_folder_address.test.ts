// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseSkillFolderAddress } from "./skill_folder_address";

describe("parseSkillFolderAddress, GitHub", () => {
  it("reads the address of a skill folder", () => {
    expect(parseSkillFolderAddress("https://github.com/anthropics/skills/tree/main/skills/pdf")).toEqual({
      url: "https://github.com/anthropics/skills/tree/main/skills/pdf",
      host: "github",
      source: "anthropics/skills",
      skillId: "pdf",
    });
  });

  it("ignores the spaces, the query, the fragment, and the slash at the end", () => {
    expect(parseSkillFolderAddress("  https://github.com/a/b/tree/main/skills/pdf/?tab=readme#top \n")?.url).toBe(
      "https://github.com/a/b/tree/main/skills/pdf",
    );
    expect(parseSkillFolderAddress("https://www.github.com/a/b/tree/main/pdf")?.skillId).toBe("pdf");
  });

  it("keeps a branch name with a slash, the last part is the skill", () => {
    expect(parseSkillFolderAddress("https://github.com/anthropics/skills/tree/klazuka/doc-skills/skill-creator")).toEqual({
      url: "https://github.com/anthropics/skills/tree/klazuka/doc-skills/skill-creator",
      host: "github",
      source: "anthropics/skills",
      skillId: "skill-creator",
    });
  });

  it("gives null for a text that is not the address of a skill folder", () => {
    for (const text of [
      "",
      "pdf",
      "docx word documents",
      "https://github.com/anthropics/skills",
      "https://github.com/anthropics/skills/tree/main",
      "https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md",
      "http://github.com/anthropics/skills/tree/main/skills/pdf",
      "https://gitlab.com/anthropics/skills/tree/main/skills/pdf",
      "https://github.com.evil.example/anthropics/skills/tree/main/skills/pdf",
      "https://github.com/anthropics//tree/main/skills/pdf",
      "https://github.com/anthropics/skills/tree/main//pdf",
    ]) {
      expect(parseSkillFolderAddress(text), text).toBeNull();
    }
  });

  it("gives null for a part that could leave the folder or break the call to GitHub", () => {
    for (const text of [
      "https://github.com/a/b/tree/main/../pdf",
      "https://github.com/a/b/tree/main/skills/.hidden",
      "https://github.com/a/b/tree/main/skills/my%20skill",
      "https://github.com/a/b/tree/main:x/pdf",
    ]) {
      expect(parseSkillFolderAddress(text), text).toBeNull();
    }
  });
});

describe("parseSkillFolderAddress, GitLab", () => {
  it("reads the address of a skill folder", () => {
    expect(parseSkillFolderAddress("https://gitlab.com/acme/agent-skills/-/tree/main/skills/pdf")).toEqual({
      url: "https://gitlab.com/acme/agent-skills/-/tree/main/skills/pdf",
      host: "gitlab",
      source: "acme/agent-skills",
      skillId: "pdf",
    });
  });

  it("reads a project in subgroups, and ignores the spaces, the query, the fragment, and the slash at the end", () => {
    expect(parseSkillFolderAddress(" https://gitlab.com/acme/team/tools/-/tree/feature/skills/pdf/?ref_type=heads#top ")).toEqual({
      url: "https://gitlab.com/acme/team/tools/-/tree/feature/skills/pdf",
      host: "gitlab",
      source: "acme/team/tools",
      skillId: "pdf",
    });
  });

  it("gives null for a text that is not the address of a skill folder on GitLab", () => {
    for (const text of [
      "https://gitlab.com/acme/agent-skills",
      "https://gitlab.com/acme/agent-skills/-/tree/main",
      "https://gitlab.com/acme/agent-skills/-/blob/main/skills/pdf/SKILL.md",
      "https://gitlab.com/acme/-/tree/main/skills/pdf",
      "https://gitlab.com/acme//agent-skills/-/tree/main/skills/pdf",
      "http://gitlab.com/acme/agent-skills/-/tree/main/skills/pdf",
      "https://gitlab.com.evil.example/acme/agent-skills/-/tree/main/skills/pdf",
      "https://gitlab.com/acme/agent-skills/-/tree/main/../pdf",
      "https://gitlab.com/acme/agent-skills/-/tree/main/skills/.hidden",
    ]) {
      expect(parseSkillFolderAddress(text), text).toBeNull();
    }
  });
});
