// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LAUNCHER_NAME_LENGTH, launcherNameFromCommand } from "./launcher_name";

describe("launcherNameFromCommand", () => {
  it("gives a short command as it is", () => {
    expect(launcherNameFromCommand("make dev")).toBe("make dev");
  });

  it("keeps the first 20 characters of a long command", () => {
    const name = launcherNameFromCommand("pnpm --filter web_frontend test");
    expect(name).toBe("pnpm --filter web_fr");
    expect(name).toHaveLength(LAUNCHER_NAME_LENGTH);
  });

  it("writes a command of several lines on one line", () => {
    expect(launcherNameFromCommand("cd web\n  pnpm install\npnpm dev")).toBe("cd web pnpm install");
  });

  it("removes the spaces at the start and at the end", () => {
    expect(launcherNameFromCommand("  make dev  ")).toBe("make dev");
    expect(launcherNameFromCommand("aaaaaaaaaaaaaaaaaaa bbb")).toBe("aaaaaaaaaaaaaaaaaaa");
  });

  it("counts a character that uses two code units as one character", () => {
    expect(Array.from(launcherNameFromCommand("🚀".repeat(30)))).toHaveLength(LAUNCHER_NAME_LENGTH);
  });

  it("gives an empty name for an empty command", () => {
    expect(launcherNameFromCommand("   \n ")).toBe("");
  });
});
