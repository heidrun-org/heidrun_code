import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { FOLDER_URL, GITLAB_URL, LOCAL_PATH, RESULT, pending, prepare } from "./skills_test_support";

/** The web address of a folder on GitHub whose subfolders `docx` and `pdf` each hold one skill. */
const PARENT_URL = "https://github.com/jeromeetienne/coding_agent_plugin/tree/main/skills";

const invoke = vi.hoisted(() => vi.fn());
const chooseFolder = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: chooseFolder }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
});

async function mountFind(answers: Record<string, unknown> = {}) {
  const prepared = await prepare(invoke, answers);
  const { default: FindSkills } = await import("./FindSkills.vue");
  return { wrapper: mount(FindSkills), ...prepared };
}

describe("FindSkills: the line Source of the skill", () => {
  it("shows three buttons: skills.sh, Local folder, Code hosting", async () => {
    const { wrapper } = await mountFind();
    expect(wrapper.findAll(".sourceChoice label").map((label) => label.text())).toEqual(["skills.sh", "Local folder", "Code hosting"]);
  });

  it("starts on skills.sh, with the field of the search", async () => {
    const { wrapper } = await mountFind();
    const radios = wrapper.findAll(".sourceChoice input[type=radio]");
    expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([true, false, false]);
    expect(wrapper.find(".search").exists()).toBe(true);
    expect(wrapper.find("input[placeholder='/Users/you/skills/pdf']").exists()).toBe(false);
  });

  it("shows the field of the chosen source, and only that field", async () => {
    const { wrapper } = await mountFind();
    await wrapper.findAll(".sourceChoice input[type=radio]")[1].setValue(true);
    expect(wrapper.find(".search").exists()).toBe(false);
    expect(wrapper.findAll("button").map((button) => button.text())).toContain("Choose folder…");
    await wrapper.findAll(".sourceChoice input[type=radio]")[2].setValue(true);
    expect(wrapper.findAll("button").map((button) => button.text())).not.toContain("Choose folder…");
    expect(wrapper.find("input[type=text]").exists()).toBe(true);
    await wrapper.findAll(".sourceChoice input[type=radio]")[0].setValue(true);
    expect(wrapper.find(".search").exists()).toBe(true);
  });

  it("keeps the text of each source when the developer goes to another source and comes back", async () => {
    const { wrapper } = await mountFind({ skills_search: [RESULT] });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await wrapper.get(".search").setValue("docx");
      vi.advanceTimersByTime(300);
    } finally {
      vi.useRealTimers();
    }
    await flushPromises();
    expect(wrapper.findAll(".list .row")).toHaveLength(1);
    await wrapper.findAll(".sourceChoice input[type=radio]")[2].setValue(true);
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
    await wrapper.findAll(".sourceChoice input[type=radio]")[0].setValue(true);
    await flushPromises();
    expect((wrapper.get(".search").element as HTMLInputElement).value).toBe("docx");
    expect(wrapper.findAll(".list .row")).toHaveLength(1);
  });
});

describe("FindSkills: source skills.sh", () => {
  it("shows a magnifying glass at the start of the field, a visible label above it, and the help below the label", async () => {
    const { wrapper } = await mountFind();
    const field = wrapper.get(".searchField");
    expect(field.find(".bi-search").exists()).toBe(true);
    const label = wrapper.get("label[for]");
    expect(label.text()).toBe("Search on skills.sh");
    expect(wrapper.get(".search").attributes("id")).toBe(label.attributes("for"));
    const help = wrapper.get(".form-text");
    expect(help.text()).toBe("Type a word. The search starts when you stop typing.");
    expect(wrapper.get(".search").attributes("aria-describedby")).toBe(help.attributes("id"));
  });

  it("lists the results of the search", async () => {
    const { wrapper, skills } = await mountFind({ skills_search: [RESULT] });
    await skills.searchSkills("docx");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_search", { query: "docx" });
    expect(wrapper.findAll(".list .row")).toHaveLength(1);
    expect(wrapper.get(".row").text()).toContain("anthropics/skills · 198,891 installs");
  });

  it("does not search on skills.sh for a web address, because the web address belongs to Code hosting", async () => {
    const { wrapper, skills } = await mountFind({ skills_search: [] });
    await skills.searchSkills(FOLDER_URL);
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_search", { query: FOLDER_URL });
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
  });

  it("says that nothing was found", async () => {
    const { wrapper, skills } = await mountFind({ skills_search: [] });
    await skills.searchSkills("zzz");
    await flushPromises();
    expect(wrapper.find(".list").exists()).toBe(false);
    expect(wrapper.findAll("p.keys").map((line) => line.text())).toEqual(["No skill found."]);
  });

  it("says No result yet while nothing was asked", async () => {
    const { wrapper } = await mountFind();
    expect(wrapper.findAll("p.keys").map((line) => line.text())).toEqual(["No result yet."]);
  });

  it("shows the error of the search", async () => {
    const { wrapper, skills } = await mountFind();
    invoke.mockImplementation(async () => {
      throw "skills_search_failed: timeout";
    });
    await skills.searchSkills("docx");
    await flushPromises();
    expect(wrapper.get(".err").text()).toBe("The search on skills.sh failed: timeout");
  });

  it("searches 300 milliseconds after the last key typed", async () => {
    const { wrapper } = await mountFind({ skills_search: [RESULT] });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const input = wrapper.get(".search");
      await input.setValue("do");
      await input.setValue("docx");
      vi.advanceTimersByTime(299);
      expect(invoke).not.toHaveBeenCalledWith("skills_search", expect.anything());
      vi.advanceTimersByTime(1);
      await flushPromises();
      expect(invoke).toHaveBeenCalledWith("skills_search", { query: "docx" });
      expect(invoke).not.toHaveBeenCalledWith("skills_search", { query: "do" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the result when the field is emptied", async () => {
    const { wrapper, skills } = await mountFind({ skills_search: [RESULT] });
    await skills.searchSkills("docx");
    await flushPromises();
    await skills.searchSkills("");
    await flushPromises();
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
    expect(wrapper.get("p.keys").text()).toBe("No result yet.");
  });

  it("ignores an answer that comes after the developer chose another source", async () => {
    const { wrapper, skills } = await mountFind();
    const slow = pending();
    invoke.mockImplementation(async (command: string) => (command === "skills_search" ? slow.promise : []));
    const search = skills.searchSkills("docx");
    await skills.setSkillSource("codeHosting");
    slow.finish([RESULT]);
    await search;
    await flushPromises();
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
    expect(skills.skills.results).toEqual([]);
  });
});

describe("FindSkills: source Local folder", () => {
  async function mountLocal(answers: Record<string, unknown> = {}) {
    const mounted = await mountFind({ skills_find_local_folders: [LOCAL_PATH], ...answers });
    await mounted.wrapper.findAll(".sourceChoice input[type=radio]")[1].setValue(true);
    return mounted;
  }

  it("shows a visible label, the help below the label, a text field, and the button Choose folder", async () => {
    const { wrapper } = await mountLocal();
    const label = wrapper.get("label[for]");
    expect(label.text()).toBe("Folder of the skill");
    const input = wrapper.get("input[type=text]");
    expect(input.attributes("id")).toBe(label.attributes("for"));
    expect(input.attributes("placeholder")).toBe("/Users/you/skills/pdf");
    expect(wrapper.get(".form-text").text()).toBe(
      "The folder of one skill (it holds the file SKILL.md), or a folder whose subfolders each hold one skill.",
    );
    expect(input.attributes("aria-describedby")).toBe(wrapper.get(".form-text").attributes("id"));
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["Choose folder…"]);
  });

  it("checks the folder 300 milliseconds after the last key typed, and shows one row", async () => {
    const { wrapper } = await mountLocal();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const input = wrapper.get("input[type=text]");
      await input.setValue("/Users/me");
      await input.setValue(LOCAL_PATH);
      vi.advanceTimersByTime(299);
      expect(invoke).not.toHaveBeenCalledWith("skills_find_local_folders", expect.anything());
      vi.advanceTimersByTime(1);
    } finally {
      vi.useRealTimers();
    }
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_find_local_folders", { path: LOCAL_PATH });
    expect(invoke).not.toHaveBeenCalledWith("skills_find_local_folders", { path: "/Users/me" });
    const rows = wrapper.findAll(".list .row");
    expect(rows).toHaveLength(1);
    expect(rows[0].get(".name").text()).toBe("pdf");
    expect(rows[0].get(".sub").text()).toBe(`${LOCAL_PATH} · Local folder`);
    expect(rows[0].findAll("button").map((button) => button.text())).toEqual(["Inspect", "Install"]);
  });

  it("shows one row for each skill of a folder whose subfolders hold a skill", async () => {
    const { wrapper, skills } = await mountLocal({ skills_find_local_folders: ["/Users/me/skills/docx", "/Users/me/skills/pdf"] });
    await skills.findLocalFolder("/Users/me/skills");
    await flushPromises();
    const rows = wrapper.findAll(".list .row");
    expect(rows.map((row) => row.get(".name").text())).toEqual(["docx", "pdf"]);
    expect(rows.map((row) => row.get(".sub").text())).toEqual(["/Users/me/skills/docx · Local folder", "/Users/me/skills/pdf · Local folder"]);
    for (const row of rows) {
      expect(row.findAll("button").map((button) => button.text())).toEqual(["Inspect", "Install"]);
    }
  });

  it("shows the error of the backend when the folder and its subfolders have no SKILL.md file", async () => {
    const { wrapper, skills } = await mountLocal();
    invoke.mockImplementation(async () => {
      throw `skills_local_folder_no_skill: ${LOCAL_PATH}`;
    });
    await skills.findLocalFolder(LOCAL_PATH);
    await flushPromises();
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
    expect(wrapper.get(".err").text()).toBe(`This folder has no SKILL.md file, and none of its subfolders has one: ${LOCAL_PATH}`);
  });

  it("shows the error of the backend when the folder does not exist", async () => {
    const { wrapper, skills } = await mountLocal();
    invoke.mockImplementation(async () => {
      throw `skills_local_folder_not_found: ${LOCAL_PATH}`;
    });
    await skills.findLocalFolder(LOCAL_PATH);
    await flushPromises();
    expect(wrapper.get(".err").text()).toBe(`This folder was not found on this computer: ${LOCAL_PATH}`);
  });

  it("opens the folder chooser, and shows the row of the folder that the developer chooses", async () => {
    const { wrapper } = await mountLocal();
    chooseFolder.mockResolvedValue(LOCAL_PATH);
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(chooseFolder).toHaveBeenCalledWith(expect.objectContaining({ directory: true, multiple: false }));
    expect((wrapper.get("input[type=text]").element as HTMLInputElement).value).toBe(LOCAL_PATH);
    expect(invoke).toHaveBeenCalledWith("skills_find_local_folders", { path: LOCAL_PATH });
    expect(wrapper.findAll(".list .row")).toHaveLength(1);
  });

  it("changes nothing when the developer cancels the folder chooser", async () => {
    const { wrapper } = await mountLocal();
    chooseFolder.mockResolvedValue(null);
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(invoke).not.toHaveBeenCalledWith("skills_find_local_folders", expect.anything());
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
  });

  it("clears the result when the field is emptied", async () => {
    const { wrapper, skills } = await mountLocal();
    await skills.findLocalFolder(LOCAL_PATH);
    await flushPromises();
    expect(wrapper.findAll(".list .row")).toHaveLength(1);
    await skills.findLocalFolder("");
    await flushPromises();
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
    expect(wrapper.get("p.keys").text()).toBe("No result yet.");
  });
});

describe("FindSkills: source Code hosting", () => {
  async function mountCodeHosting(answers: Record<string, unknown> = {}) {
    const mounted = await mountFind({ skills_find_folders: [FOLDER_URL], ...answers });
    await mounted.wrapper.findAll(".sourceChoice input[type=radio]")[2].setValue(true);
    return mounted;
  }

  /** Types `text` in the field, waits for the check to start, and waits for its answer. */
  async function typeAddress(wrapper: Awaited<ReturnType<typeof mountCodeHosting>>["wrapper"], text: string) {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await wrapper.get("input[type=text]").setValue(text);
      vi.advanceTimersByTime(500);
    } finally {
      vi.useRealTimers();
    }
    await flushPromises();
  }

  it("shows a visible label, the help below the label, and a text field", async () => {
    const { wrapper } = await mountCodeHosting();
    const label = wrapper.get("label[for]");
    expect(label.text()).toBe("Web address of the skill folder");
    const input = wrapper.get("input[type=text]");
    expect(input.attributes("id")).toBe(label.attributes("for"));
    expect(input.attributes("placeholder")).toBe("https://github.com/owner/repository/tree/main/skills/pdf");
    expect(wrapper.get(".form-text").text()).toBe(
      "A folder on GitHub or GitLab: the folder of one skill (it holds the file SKILL.md), or a folder whose subfolders each hold one skill.",
    );
    expect(input.attributes("aria-describedby")).toBe(wrapper.get(".form-text").attributes("id"));
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("asks the backend 500 milliseconds after the last key typed, and shows one row for a skill folder on GitHub", async () => {
    const { wrapper } = await mountCodeHosting();
    invoke.mockClear();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const input = wrapper.get("input[type=text]");
      await input.setValue("https://github.com/anthropics");
      await input.setValue(FOLDER_URL);
      vi.advanceTimersByTime(499);
      expect(invoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
    } finally {
      vi.useRealTimers();
    }
    await flushPromises();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("skills_find_folders", { url: FOLDER_URL });
    const rows = wrapper.findAll(".list .row");
    expect(rows).toHaveLength(1);
    expect(rows[0].get(".name").text()).toBe("pdf");
    expect(rows[0].get(".sub").text()).toBe("anthropics/skills · GitHub folder");
    expect(rows[0].findAll("button").map((button) => button.text())).toEqual(["Inspect", "Install"]);
  });

  it("shows one row for a skill folder on GitLab", async () => {
    const { wrapper } = await mountCodeHosting({ skills_find_folders: [GITLAB_URL] });
    await typeAddress(wrapper, GITLAB_URL);
    const rows = wrapper.findAll(".list .row");
    expect(rows).toHaveLength(1);
    expect(rows[0].get(".name").text()).toBe("pdf");
    expect(rows[0].get(".sub").text()).toBe("acme/agent-skills · GitLab folder");
  });

  it("shows one row for each skill of a folder whose subfolders hold a skill", async () => {
    const { wrapper } = await mountCodeHosting({ skills_find_folders: [`${PARENT_URL}/docx`, `${PARENT_URL}/pdf`] });
    await typeAddress(wrapper, PARENT_URL);
    expect(invoke).toHaveBeenCalledWith("skills_find_folders", { url: PARENT_URL });
    const rows = wrapper.findAll(".list .row");
    expect(rows.map((row) => row.get(".name").text())).toEqual(["docx", "pdf"]);
    expect(rows.map((row) => row.get(".sub").text())).toEqual([
      "jeromeetienne/coding_agent_plugin · GitHub folder",
      "jeromeetienne/coding_agent_plugin · GitHub folder",
    ]);
    for (const row of rows) {
      expect(row.findAll("button").map((button) => button.text())).toEqual(["Inspect", "Install"]);
    }
  });

  it("inspects the folder of one row of a list with the address of that row", async () => {
    const { wrapper } = await mountCodeHosting({
      skills_find_folders: [`${PARENT_URL}/docx`, `${PARENT_URL}/pdf`],
      skills_preview_folder: "---\nname: pdf\n---",
    });
    await typeAddress(wrapper, PARENT_URL);
    await wrapper.findAll(".list .row")[1].findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_preview_folder", { url: `${PARENT_URL}/pdf` });
  });

  it("shows an error for a text that is not the web address of a folder, with no call to the backend", async () => {
    const { wrapper } = await mountCodeHosting();
    invoke.mockClear();
    await typeAddress(wrapper, "https://github.com/anthropics/skills");
    expect(invoke).not.toHaveBeenCalled();
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
    expect(wrapper.get(".err").text()).toBe(
      "This is not the web address of a skill folder on GitHub or GitLab: https://github.com/anthropics/skills",
    );
  });

  it("shows the error of the backend when the folder and its subfolders have no SKILL.md file", async () => {
    const { wrapper, skills } = await mountCodeHosting();
    invoke.mockImplementation(async () => {
      throw "skills_folder_no_skill: jeromeetienne/coding_agent_plugin/main/skills";
    });
    await skills.findAddress(PARENT_URL);
    await flushPromises();
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
    expect(wrapper.get(".err").text()).toBe(
      "This folder has no SKILL.md file, and none of its subfolders has one: jeromeetienne/coding_agent_plugin/main/skills",
    );
  });

  it("says Searching while GitHub or GitLab answers, and ignores an answer that comes after the address changed", async () => {
    const { wrapper, skills } = await mountCodeHosting();
    const slow = pending();
    invoke.mockImplementation(async (command: string) => (command === "skills_find_folders" ? slow.promise : []));
    const search = skills.findAddress(PARENT_URL);
    await flushPromises();
    expect(wrapper.get("p.keys").text()).toBe("Searching…");
    skills.skills.address = FOLDER_URL;
    slow.finish([`${PARENT_URL}/docx`]);
    await search;
    await flushPromises();
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
  });

  it("removes the error when the address becomes right, and clears the result when the field is emptied", async () => {
    const { wrapper } = await mountCodeHosting({ skills_find_folders: [GITLAB_URL] });
    await typeAddress(wrapper, "https://gitlab.com/acme");
    expect(wrapper.find(".err").exists()).toBe(true);
    await typeAddress(wrapper, GITLAB_URL);
    expect(wrapper.find(".err").exists()).toBe(false);
    expect(wrapper.findAll(".list .row")).toHaveLength(1);
    await typeAddress(wrapper, "");
    expect(wrapper.findAll(".list .row")).toHaveLength(0);
    expect(wrapper.get("p.keys").text()).toBe("No result yet.");
  });
});
