import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("errorText", () => {
  it("gives the text of a known code of the backend", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_already_installed: pdf")).toBe("The skill pdf is already installed at this level");
  });

  it("tells the time when GitHub accepts requests again", async () => {
    const { errorText } = await import("./skills");
    const reset = new Date(2026, 9, 10, 15, 4, 46).getTime() / 1000;
    const text = errorText(`skills_github_rate_limit: ${reset}`);
    expect(text).toMatch(/^GitHub refuses more requests for now\. Try again at .*(15:04|3:04)/);
  });

  it("says a few minutes when GitHub does not give the time", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_github_rate_limit")).toBe("GitHub refuses more requests for now. Try again in a few minutes.");
  });

  it("shows an unknown error as it is", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("something_else: boom")).toBe("something_else: boom");
  });

  it("tells that a folder was not found, or that an address is not a folder", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_folder_not_found: a/b/main/skills/x")).toBe(
      "This folder was not found: a/b/main/skills/x. The repository must be public, and the folder must have a SKILL.md file.",
    );
    expect(errorText("skills_invalid_address: https://example.com/x")).toBe(
      "This is not the web address of a skill folder on GitHub or GitLab: https://example.com/x",
    );
  });

  it("tells what is wrong with a folder on this computer", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_invalid_path: pdf")).toBe("This is not the full path of a folder: pdf");
    expect(errorText("skills_local_folder_not_found: /a/b")).toBe("This folder was not found on this computer: /a/b");
    expect(errorText("skills_local_folder_no_skill_file: /a/b")).toBe("This folder has no SKILL.md file: /a/b");
    expect(errorText("skills_local_folder_no_skill: /a/b")).toBe("This folder has no SKILL.md file, and none of its subfolders has one: /a/b");
  });

  it("tells that a folder on GitHub or GitLab has no skill, or has too many files to be read", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_folder_no_skill: a/b/main/skills")).toBe(
      "This folder has no SKILL.md file, and none of its subfolders has one: a/b/main/skills",
    );
    expect(errorText("skills_folder_too_large: a/b/main/skills")).toBe("This folder has too many files to look for skills in it: a/b/main/skills");
  });

  it("tells that a link already exists", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_already_linked: pdf")).toBe("The skill pdf is already in the folder of this agent");
  });
});

describe("originLabel", () => {
  it("says GitHub or GitLab for a skill installed from a web address, Local folder for a copied folder, and skills.sh for the others", async () => {
    const { originLabel } = await import("./skills");
    const skill = { name: "pdf", description: "", level: "user" as const, path: "/p", agents: [] };
    const fromAddress = { ...skill, origin: { source: "a/b", skill_id: "pdf", folder_url: "https://github.com/a/b/tree/main/pdf" } };
    expect(originLabel(fromAddress)).toBe("GitHub · a/b");
    const fromGitlab = { ...skill, origin: { source: "a/b", skill_id: "pdf", folder_url: "https://gitlab.com/a/b/-/tree/main/pdf" } };
    expect(originLabel(fromGitlab)).toBe("GitLab · a/b");
    const fromFolder = { ...skill, origin: { source: "", skill_id: "pdf", folder_path: "/Users/me/pdf" } };
    expect(originLabel(fromFolder)).toBe("Local folder · /Users/me/pdf");
    expect(originLabel({ ...skill, origin: { source: "a/b", skill_id: "pdf" } })).toBe("skills.sh · a/b");
    expect(originLabel({ ...skill, origin: null })).toBe("Local");
  });
});

describe("resultOrigin", () => {
  it("tells the place of a result: skills.sh, a local folder, GitHub, or GitLab", async () => {
    const { resultOrigin } = await import("./skills");
    const base = { source: "a/b", skillId: "pdf", name: "pdf", installs: 0 };
    expect(resultOrigin(base)).toBe("skillsSh");
    expect(resultOrigin({ ...base, folderPath: "/x/pdf" })).toBe("localFolder");
    expect(resultOrigin({ ...base, folderUrl: "https://github.com/a/b/tree/main/pdf", host: "github" })).toBe("github");
    expect(resultOrigin({ ...base, folderUrl: "https://gitlab.com/a/b/-/tree/main/pdf", host: "gitlab" })).toBe("gitlab");
  });

  it("gives each result a key that differs between sources", async () => {
    const { resultKey } = await import("./skills");
    const base = { source: "a/b", skillId: "pdf", name: "pdf", installs: 0 };
    expect(resultKey(base)).toBe("a/b/pdf");
    expect(resultKey({ ...base, folderPath: "/x/pdf" })).toBe("/x/pdf");
    expect(resultKey({ ...base, folderUrl: "https://github.com/a/b/tree/main/pdf" })).toBe("https://github.com/a/b/tree/main/pdf");
  });
});
