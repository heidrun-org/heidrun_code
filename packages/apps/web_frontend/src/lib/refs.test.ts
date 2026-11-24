// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EMPTY_CONTEXT,
  findChoices,
  findQuestion,
  findRefs,
  remoteToWeb,
  type RefContext,
} from "./refs";

const GITLAB: RefContext = {
  base: "https://gitlab.com/group/app",
  origin: "https://gitlab.com",
  forge: "gitlab",
  ticketUrl: null,
  ticketPrefixes: [],
  enabled: true,
};
const GITHUB: RefContext = { ...GITLAB, base: "https://github.com/org/app", origin: "https://github.com", forge: "github" };

describe("remoteToWeb", () => {
  it("converts an scp-like remote", () => {
    expect(remoteToWeb("git@github.com:org/app.git")).toEqual({
      base: "https://github.com/org/app",
      origin: "https://github.com",
      host: "github.com",
    });
  });

  it("converts an ssh URL with a port", () => {
    expect(remoteToWeb("ssh://git@gitlab.acme.io:2222/group/sub/app")?.base).toBe("https://gitlab.acme.io/group/sub/app");
  });

  it("converts an https URL with a user", () => {
    expect(remoteToWeb("https://user@host.io/g/a.git/")?.base).toBe("https://host.io/g/a");
  });

  it("refuses a value that is not a remote", () => {
    expect(remoteToWeb("not a remote")).toBeNull();
    expect(remoteToWeb("")).toBeNull();
  });
});

describe('findRefs', () => {
	it('uses the workspace repository for shorthand references', () => {
		expect(findRefs('Fix #12 and !34', GITHUB)).toMatchObject([
			{
				url: 'https://github.com/org/app/issues/12',
				target: { type: 'issue', number: 12 },
			},
		]);
		expect(findRefs('Fix #12 and !34', GITLAB).map((reference) => reference.url)).toEqual([
			'https://gitlab.com/group/app/-/issues/12',
			'https://gitlab.com/group/app/-/merge_requests/34',
		]);
	});

	it('uses the repository named in a full address without a workspace repository', () => {
		const addresses = [
			'https://github.com/org/lib/issues/7',
			'https://github.com/org/lib/pull/12?tab=files#discussion',
			'https://gitlab.com/group/sub/app/-/work_items/4',
			'https://gitlab.com/group/sub/app/-/merge_requests/5',
		];
		const references = findRefs(addresses.map((address) => '`' + address + '`.').join(' '), EMPTY_CONTEXT);
		expect(references.map((reference) => reference.url)).toEqual(addresses);
		expect(references.map((reference) => reference.kind)).toEqual(['issue', 'mr', 'issue', 'mr']);
		expect(references[3].target.project).toBe('group/sub/app');
	});

	it('recognizes an address on the configured self-managed hosting service', () => {
		const context = {
			...GITLAB,
			base: 'https://gitlab.example.com/group/app',
			origin: 'https://gitlab.example.com',
		};
		expect(findRefs('https://gitlab.example.com/group/app/-/merge_requests/5', context)).toHaveLength(1);
		expect(findRefs('https://another.example.com/group/app/-/issues/5', context)).toEqual([]);
	});

	it('ignores other text, URL fragments, relative references, and chat image markers', () => {
		expect(findRefs(
			'https://example.com/issues/12#13 https://github.com/issues/9 /pull/12 ABC-123 26d63ea ' +
			'[Image #1] src/app.ts:42 ! pnpm test /compact 1. Open it',
			GITHUB,
		)).toEqual([]);
	});

	it('requires a repository for shorthand and respects the project reference switch', () => {
		expect(findRefs('#12 !34', EMPTY_CONTEXT)).toEqual([]);
		expect(findRefs('#12 https://github.com/org/app/pull/12', {
			...GITHUB,
			enabled: false,
		})).toEqual([]);
	});
});

describe("findQuestion", () => {
  it("returns the question that ends the last message", () => {
    expect(findQuestion("● Done with the change.\n\n  Should I open a pull request?")).toBe("Should I open a pull request?");
  });

  it("returns null when the message does not end with a question", () => {
    expect(findQuestion("● All done.")).toBeNull();
  });

  it("ignores the prompt box under the message", () => {
    const screen = ["● Ready?", "", "────────────", "❯ yes", "────────────"].join("\n");
    expect(findQuestion(screen)).toBe("Ready?");
  });

  it("ignores the status lines after the message", () => {
    expect(findQuestion("● Merge now?\n\n✻ Worked for 2m 3s")).toBe("Merge now?");
  });
});

describe("findChoices", () => {
  const menu = [
    "Do you want to run this command?",
    "  git status",
    "❯ 1. Yes",
    "  2. Yes, and do not ask again",
    "  3. No",
  ].join("\n");

  it("reads a numbered menu with its question", () => {
    const result = findChoices(menu);
    expect(result?.question).toBe("git status");
    expect(result?.options.map((o) => o.label)).toEqual(["Yes", "Yes, and do not ask again", "No"]);
    expect(result?.options[0].selected).toBe(true);
  });

  it("returns null for a list without a selected option", () => {
    expect(findChoices("1. one\n2. two")).toBeNull();
  });

  it("returns null when there is only one option", () => {
    expect(findChoices("❯ 1. Only")).toBeNull();
  });

  it("returns null when the list is followed by more text", () => {
    const screen = `${menu}\nmore\ntext\nafter\nthe menu`;
    expect(findChoices(screen)).toBeNull();
  });
});
