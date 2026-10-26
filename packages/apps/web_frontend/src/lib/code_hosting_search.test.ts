// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  githubSearchArguments,
  githubState,
  parseSearch,
  searchHasLabel,
  splitSearch,
  toggleLabelInSearch,
  translateForGitlab,
  usesCurrentUser,
} from "./code_hosting_search";

describe("splitSearch", () => {
  it("cuts a search at the spaces", () => {
    expect(splitSearch("author:@me   label:bug ")).toEqual(["author:@me", "label:bug"]);
  });

  it("keeps a quoted value in one word", () => {
    expect(splitSearch('label:"good first issue" -author:eric')).toEqual(['label:"good first issue"', "-author:eric"]);
  });

  it("gives no word for an empty search", () => {
    expect(splitSearch("   ")).toEqual([]);
  });
});

describe("parseSearch", () => {
  it("reads the qualifier, the value, and the minus sign", () => {
    expect(parseSearch("-label:bug")).toEqual([
      { text: "-label:bug", isNegated: true, qualifier: "label", value: "bug", isQuoted: false },
    ]);
  });

  it("removes the quotes of a value", () => {
    expect(parseSearch('label:"good first issue"')[0]).toMatchObject({ qualifier: "label", value: "good first issue", isQuoted: true });
  });

  it("reads a word without colon as a free word", () => {
    expect(parseSearch("crash")[0]).toMatchObject({ qualifier: null, value: "crash", isNegated: false });
  });

  it("reads a lone minus sign as a free word", () => {
    expect(parseSearch("-")[0]).toMatchObject({ qualifier: null, isNegated: false });
  });
});

describe("githubState", () => {
  it("reads the open items when the search names no state", () => {
    expect(githubState("author:@me label:bug")).toBe("open");
    expect(githubState("")).toBe("open");
  });

  it.each(["is:closed", "is:merged", "is:open", "state:closed", "-is:open"])("reads all the items for %s", (search) => {
    expect(githubState(search)).toBe("all");
  });
});

describe("githubSearchArguments", () => {
  it("gives the flag --search with the trimmed search", () => {
    expect(githubSearchArguments("  author:@me ")).toEqual(["--search", "author:@me"]);
  });

  it("gives nothing for an empty search", () => {
    expect(githubSearchArguments("  ")).toEqual([]);
  });
});

describe("usesCurrentUser", () => {
  it("tells that @me is used as a value", () => {
    expect(usesCurrentUser("label:bug assignee:@me")).toBe(true);
    expect(usesCurrentUser("label:bug")).toBe(false);
    expect(usesCurrentUser("@me")).toBe(false);
  });
});

describe("translateForGitlab", () => {
  it("gives the open state alone for an empty search", () => {
    expect(translateForGitlab("issues", "", null)).toEqual({ kind: "filters", parameters: ["state=opened"] });
  });

  it("translates the author, the assignee, the milestone, and the labels", () => {
    expect(translateForGitlab("issues", 'author:eric assignee:jerome milestone:v2 label:bug label:"good first issue"', null)).toEqual({
      kind: "filters",
      parameters: [
        "state=opened",
        "author_username=eric",
        "assignee_username%5B%5D=jerome",
        "milestone=v2",
        "labels=bug%2Cgood%20first%20issue",
      ],
    });
  });

  it("translates the minus sign into the parameters not[...]", () => {
    expect(translateForGitlab("requests", "-author:eric -assignee:jerome -milestone:v2 -label:bug -label:idea", null)).toEqual({
      kind: "filters",
      parameters: [
        "state=opened",
        "not%5Bauthor_username%5D=eric",
        "not%5Bassignee_username%5D=jerome",
        "not%5Bmilestone%5D=v2",
        "not%5Blabels%5D=bug%2Cidea",
      ],
    });
  });

  it("replaces @me with the login", () => {
    expect(translateForGitlab("issues", "author:@me", "jerome")).toEqual({
      kind: "filters",
      parameters: ["state=opened", "author_username=jerome"],
    });
  });

  it("cannot do @me when the login is not known", () => {
    expect(translateForGitlab("issues", "author:@me", null)).toEqual({ kind: "cannot", word: "author:@me" });
  });

  it("translates no:label, no:assignee, and no:milestone", () => {
    expect(translateForGitlab("issues", "no:label no:assignee no:milestone", null)).toEqual({
      kind: "filters",
      parameters: ["state=opened", "labels=None", "assignee_id=None", "milestone=None"],
    });
  });

  it("translates the states", () => {
    expect(translateForGitlab("issues", "is:closed", null)).toEqual({ kind: "filters", parameters: ["state=closed"] });
    expect(translateForGitlab("requests", "is:merged", null)).toEqual({ kind: "filters", parameters: ["state=merged"] });
    expect(translateForGitlab("requests", "is:open", null)).toEqual({ kind: "filters", parameters: ["state=opened"] });
  });

  it("leaves the issues empty for is:merged", () => {
    expect(translateForGitlab("issues", "is:merged", null)).toEqual({ kind: "empty" });
  });

  it("reads review-requested on the merge requests, and leaves the issues empty", () => {
    expect(translateForGitlab("requests", "review-requested:@me", "jerome")).toEqual({
      kind: "filters",
      parameters: ["state=opened", "reviewer_username=jerome"],
    });
    expect(translateForGitlab("issues", "review-requested:@me", "jerome")).toEqual({ kind: "empty" });
  });

  it("joins the free words, and drops AND", () => {
    expect(translateForGitlab("issues", "crash AND login", null)).toEqual({
      kind: "filters",
      parameters: ["state=opened", "search=crash%20login"],
    });
  });

  it.each([
    ["mentions:@me", "mentions:@me"],
    ["involves:eric", "involves:eric"],
    ["label:bug OR label:idea", "OR"],
    ["(label:bug", "(label:bug"],
    ["label:bug)", "label:bug)"],
    ["label:bug,idea", "label:bug,idea"],
    ["sort:created-asc", "sort:created-asc"],
    ["updated:<2026-09-01", "updated:<2026-09-01"],
    ["-crash", "-crash"],
    ['"exact phrase"', '"exact phrase"'],
    ["-is:open", "-is:open"],
    ["is:draft", "is:draft"],
    ["-review-requested:eric", "-review-requested:eric"],
    ["-no:label", "-no:label"],
    ["no:project", "no:project"],
    ["author:eric author:jerome", "author:jerome"],
    ["assignee:eric assignee:jerome", "assignee:jerome"],
    ["label:bug no:label", "no:label"],
    ["no:label label:bug", "label:bug"],
    ["no:assignee assignee:eric", "assignee:eric"],
    ["is:open is:closed", "is:closed"],
    ["http://example.com", "http://example.com"],
  ])("cannot do the search %s, and names the word %s", (search, word) => {
    expect(translateForGitlab("issues", search, "jerome")).toEqual({ kind: "cannot", word });
  });

  it("encodes a value so that it cannot add a parameter", () => {
    expect(translateForGitlab("issues", "label:a&state=closed", null)).toEqual({
      kind: "filters",
      parameters: ["state=opened", "labels=a%26state%3Dclosed"],
    });
  });
});

describe("toggleLabelInSearch", () => {
  it("adds the label to an empty search", () => {
    expect(toggleLabelInSearch("", "enhancement")).toBe("label:enhancement");
  });

  it("adds the label after the words that are already in the search", () => {
    expect(toggleLabelInSearch("author:@me label:bug", "enhancement")).toBe("author:@me label:bug label:enhancement");
  });

  it("removes the label when the search already asks for it, and keeps the other words", () => {
    expect(toggleLabelInSearch("author:@me label:enhancement label:bug", "enhancement")).toBe("author:@me label:bug");
  });

  it("removes the label and leaves an empty search when it was the only word", () => {
    expect(toggleLabelInSearch("label:enhancement", "enhancement")).toBe("");
  });

  it("writes the name of a label between double quotes when it has a space, and removes it the same way", () => {
    const added = toggleLabelInSearch("is:open", "Simple Work");
    expect(added).toBe('is:open label:"Simple Work"');
    expect(toggleLabelInSearch(added, "Simple Work")).toBe("is:open");
  });

  it("finds the label whatever the capital letters, and with or without quotes", () => {
    expect(toggleLabelInSearch("label:Enhancement", "enhancement")).toBe("");
    expect(toggleLabelInSearch('label:"enhancement"', "enhancement")).toBe("");
  });

  it("adds the label, and keeps the word, when the search holds the same label with a minus sign", () => {
    expect(toggleLabelInSearch("-label:bug", "bug")).toBe("-label:bug label:bug");
  });

  it("does not take a label that only starts with the same letters", () => {
    expect(toggleLabelInSearch("label:bug-report", "bug")).toBe("label:bug-report label:bug");
  });
});

describe("searchHasLabel", () => {
  it("tells whether the search asks for the label", () => {
    expect(searchHasLabel("author:@me label:bug", "bug")).toBe(true);
    expect(searchHasLabel("author:@me label:bug", "enhancement")).toBe(false);
    expect(searchHasLabel("-label:bug", "bug")).toBe(false);
    expect(searchHasLabel("", "bug")).toBe(false);
  });
});
