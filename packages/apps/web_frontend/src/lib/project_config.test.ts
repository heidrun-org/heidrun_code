// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseProjectConfig, parseReferences, projectConfigSchema } from "./project_config";

describe("parseProjectConfig", () => {
  it("accepts a minimal configuration and defaults the launchers to an empty list", () => {
    expect(parseProjectConfig({ version: 1 })).toEqual({ version: 1, launchers: [] });
  });

  it("accepts a full configuration", () => {
    const config = parseProjectConfig({
      version: 1,
      launchers: [{ id: "build", label: "Build", command: "pnpm build", cwd: "packages/apps/web_frontend" }],
      references: { forge: "github", repo: "org/app", tickets: { url: "https://x/{key}", prefixes: ["ABC"] } },
      guards: { confirm: ["^make"], block: ["publish"] },
      prompts: [{ text: "Review this" }],
    });
    expect(config.launchers[0].id).toBe("build");
    expect(config.references?.forge).toBe("github");
  });

  it("rejects a wrong version", () => {
    expect(() => parseProjectConfig({ version: 2 })).toThrow(/version/);
  });

  it("rejects an unknown field and names it", () => {
    expect(() => parseProjectConfig({ version: 1, colour: "red" })).toThrow(/colour|Unrecognized/);
  });

  it("names the path of the invalid field", () => {
    expect(() => parseProjectConfig({ version: 1, launchers: [{ id: "a", label: "A", command: "" }] })).toThrow(
      /launchers\.0\.command/,
    );
  });

  it("names the root when the value is not an object", () => {
    expect(() => parseProjectConfig("text")).toThrow();
  });

  it("rejects an unknown forge", () => {
    expect(() => parseProjectConfig({ version: 1, references: { forge: "bitbucket" } })).toThrow(/references\.forge/);
  });

  it("rejects an empty prompt text", () => {
    expect(() => parseProjectConfig({ version: 1, prompts: [{ text: "" }] })).toThrow(/prompts\.0\.text/);
  });

  it("joins several problems with a semicolon", () => {
    expect(() => parseProjectConfig({ version: 3, extra: true })).toThrow(/;/);
  });
});

describe("parseProjectConfig with the old key actions", () => {
  it("reads the list under the old key actions as the list of launchers", () => {
    const config = parseProjectConfig({ version: 1, actions: [{ id: "build", label: "Build", command: "pnpm build" }] });
    expect(config.launchers).toEqual([{ id: "build", label: "Build", command: "pnpm build" }]);
  });

  it("returns a configuration that has the key launchers and no key actions", () => {
    const config = parseProjectConfig({ version: 1, actions: [{ id: "build", label: "Build", command: "pnpm build" }] });
    expect(Object.keys(config)).toContain("launchers");
    expect(Object.keys(config)).not.toContain("actions");
  });

  it("names the path of an invalid field under the old key actions with the key launchers", () => {
    expect(() => parseProjectConfig({ version: 1, actions: [{ id: "a", label: "A", command: "" }] })).toThrow(
      /launchers\.0\.command/,
    );
  });

  it("rejects a file that has both the key actions and the key launchers, and names the key actions", () => {
    expect(() => parseProjectConfig({ version: 1, actions: [], launchers: [] })).toThrow(/actions/);
  });
});

describe("parseReferences", () => {
  it("accepts a ticket URL given as a string", () => {
    expect(parseReferences({ tickets: "https://x/{key}" }).tickets).toBe("https://x/{key}");
  });

  it("accepts an empty object", () => {
    expect(parseReferences({})).toEqual({});
  });

  it("rejects an empty repo", () => {
    expect(() => parseReferences({ repo: "" })).toThrow(/repo/);
  });

  it("rejects an unknown field", () => {
    expect(() => parseReferences({ unknown: 1 })).toThrow();
  });
});

describe("the key guards", () => {
  it("accepts the list disabled, with the keys of the built-in guards", () => {
    const config = parseProjectConfig({ version: 1, guards: { disabled: ["guards.why.gitClean"] } });
    expect(config.guards).toEqual({ disabled: ["guards.why.gitClean"] });
  });

  it("rejects a list disabled that is not a list of strings", () => {
    expect(() => parseProjectConfig({ version: 1, guards: { disabled: "guards.why.gitClean" } })).toThrow(/guards\.disabled/);
    expect(() => parseProjectConfig({ version: 1, guards: { disabled: [3] } })).toThrow(/guards\.disabled/);
  });

  it("accepts the list projectGuards, with a name, a description, an action, and lines", () => {
    const projectGuards = [
      {
        name: "Publish",
        description: "Publishing cannot be undone.",
        action: "block",
        matches: [
          { type: "startsWith", text: "npm publish" },
          { type: "regex", text: "yarn\\s+publish" },
        ],
      },
    ];
    expect(parseProjectConfig({ version: 1, guards: { projectGuards } }).guards).toEqual({ projectGuards });
  });

  it("accepts a project guard with no description", () => {
    const projectGuards = [{ name: "Make", action: "confirm", matches: [{ type: "contains", text: "make deploy" }] }];
    expect(parseProjectConfig({ version: 1, guards: { projectGuards } }).guards).toEqual({ projectGuards });
  });

  it("still accepts the old lists confirm and block", () => {
    const config = parseProjectConfig({ version: 1, guards: { confirm: ["^make"], block: ["publish"] } });
    expect(config.guards).toEqual({ confirm: ["^make"], block: ["publish"] });
  });

  it("rejects a project guard with no line, an empty name, an empty line, an unknown action, or an unknown type", () => {
    const base = { name: "A", action: "confirm", matches: [{ type: "contains", text: "x" }] };
    const bad = [
      { ...base, matches: [] },
      { ...base, name: "" },
      { ...base, matches: [{ type: "contains", text: "" }] },
      { ...base, action: "ask" },
      { ...base, matches: [{ type: "like", text: "x" }] },
      { ...base, oops: 1 },
    ];
    for (const guard of bad) {
      expect(() => parseProjectConfig({ version: 1, guards: { projectGuards: [guard] } })).toThrow(/guards\.projectGuards\.0/);
    }
  });
});

describe("projectConfigSchema", () => {
  it("is strict at every level", () => {
    expect(projectConfigSchema.safeParse({ version: 1, guards: { confirm: [], oops: [] } }).success).toBe(false);
  });
});
