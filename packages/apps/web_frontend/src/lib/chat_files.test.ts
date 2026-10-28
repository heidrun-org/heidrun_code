// @vitest-environment node
import { describe, expect, it } from "vitest";
import { chatFiles, fileFolder, fileIconName, fileName, fileWebUrl, relativeFilePath } from "./chat_files";

describe("relativeFilePath", () => {
  it("gives the path below the root of the repository", () => {
    expect(relativeFilePath("/work/app", "/work/app/src/main.ts")).toBe("src/main.ts");
    expect(relativeFilePath("/work/app/", "/work/app/src/main.ts")).toBe("src/main.ts");
  });

  it("gives the path of the same file at the root for a file in a worktree inside the repository", () => {
    expect(relativeFilePath("/work/app", "/work/app/.claude/worktrees/fix-tab-35/src/main.ts")).toBe("src/main.ts");
  });

  it("keeps the other files of the folder .claude", () => {
    expect(relativeFilePath("/work/app", "/work/app/.claude/settings.json")).toBe(".claude/settings.json");
    expect(relativeFilePath("/work/app", "/work/app/.claude/worktrees/notes.md")).toBe(".claude/worktrees/notes.md");
  });

  it("gives null when the root is not known, or when the file is not below the root", () => {
    expect(relativeFilePath(null, "/work/app/src/main.ts")).toBeNull();
    expect(relativeFilePath("/work/app", "/work/application/main.ts")).toBeNull();
    expect(relativeFilePath("/work/app", "/work/app")).toBeNull();
    expect(relativeFilePath("/work/app", "/work/app/")).toBeNull();
    expect(relativeFilePath("/work/app", "/elsewhere/main.ts")).toBeNull();
  });
});

describe("chatFiles", () => {
  it("names each file with its path below the root, and opens the file at the root", () => {
    expect(chatFiles("/work/app", ["/work/app/.claude/worktrees/fix/src/a.rs", "/elsewhere/b.md"])).toEqual([
      { relativePath: "src/a.rs", label: "src/a.rs", openPath: "/work/app/src/a.rs" },
      { relativePath: null, label: "/elsewhere/b.md", openPath: "/elsewhere/b.md" },
    ]);
  });

  it("counts a file written in a worktree and the same file at the root once", () => {
    const files = chatFiles("/work/app", [
      "/work/app/.claude/worktrees/one/src/a.rs",
      "/work/app/src/a.rs",
      "/work/app/.claude/worktrees/two/src/a.rs",
      "/work/app/src/b.rs",
    ]);
    expect(files.map((file) => file.label)).toEqual(["src/a.rs", "src/b.rs"]);
  });

  it("keeps the absolute paths when the root is not known", () => {
    expect(chatFiles(null, ["/work/app/a.rs"])).toEqual([
      { relativePath: null, label: "/work/app/a.rs", openPath: "/work/app/a.rs" },
    ]);
  });
});

describe("fileWebUrl", () => {
  it("gives the address of the file on GitHub, on the default branch", () => {
    expect(fileWebUrl("https://github.com/heidrun-org/heidrun", "github", "src/a b.ts")).toBe(
      "https://github.com/heidrun-org/heidrun/blob/HEAD/src/a%20b.ts",
    );
  });

  it("gives the address of the file on GitLab, on the default branch", () => {
    expect(fileWebUrl("https://gitlab.com/group/app", "gitlab", "src/main.ts")).toBe(
      "https://gitlab.com/group/app/-/blob/HEAD/src/main.ts",
    );
  });

  it("gives null when the repository has no address or no forge", () => {
    expect(fileWebUrl(null, "github", "a.ts")).toBeNull();
    expect(fileWebUrl("https://github.com/x/y", null, "a.ts")).toBeNull();
  });
});

describe("fileName and fileFolder", () => {
  it("split a path into the name and the folders", () => {
    expect(fileName("/work/app/src/main.ts")).toBe("main.ts");
    expect(fileFolder("/work/app/src/main.ts")).toBe("/work/app/src");
    expect(fileName("src/main.ts")).toBe("main.ts");
    expect(fileFolder("src/main.ts")).toBe("src");
  });

  it("give an empty folder for a file at the root", () => {
    expect(fileName("main.ts")).toBe("main.ts");
    expect(fileFolder("main.ts")).toBe("");
    expect(fileFolder("/main.ts")).toBe("");
  });
});

describe("fileIconName", () => {
  it("shows the kind of a file from its extension", () => {
    expect(fileIconName("chats.rs")).toBe("file-earmark-code");
    expect(fileIconName("ChatsPanel.vue")).toBe("file-earmark-code");
    expect(fileIconName("README.md")).toBe("file-earmark-text");
    expect(fileIconName("package.json")).toBe("file-earmark-ruled");
    expect(fileIconName("logo.PNG")).toBe("file-earmark-image");
    expect(fileIconName("Makefile")).toBe("file-earmark");
    expect(fileIconName("notes.xyz")).toBe("file-earmark");
  });
});
