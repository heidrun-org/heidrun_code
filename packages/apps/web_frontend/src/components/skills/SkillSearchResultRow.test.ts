import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { FOLDER_RESULT, FOLDER_URL, GITLAB_RESULT, GITLAB_URL, INSTALLED, LOCAL_PATH, LOCAL_RESULT, RESULT, pending, prepare } from "./skills_test_support";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
});

async function mountRow(result = RESULT, answers: Record<string, unknown> = {}) {
  const prepared = await prepare(invoke, answers);
  const { default: SkillSearchResultRow } = await import("./SkillSearchResultRow.vue");
  return { wrapper: mount(SkillSearchResultRow, { props: { result } }), ...prepared };
}

describe("SkillSearchResultRow: display", () => {
  it("shows the name, the source and the number of installs", async () => {
    const { wrapper } = await mountRow();
    expect(wrapper.get(".name").text()).toBe("docx");
    expect(wrapper.get(".sub").text()).toBe("anthropics/skills · 198,891 installs");
  });

  it("shows an icon before the text of the buttons Inspect and Install", async () => {
    const { wrapper } = await mountRow();
    const buttons = wrapper.findAll("button");
    expect(buttons[0].find(".bi-eye").exists()).toBe(true);
    expect(buttons[1].find(".bi-download").exists()).toBe(true);
  });

  it("shows a skill as installed at the chosen level, and as installable at the other level", async () => {
    const pdf = { source: "anthropics/skills", skillId: "pdf", name: "pdf", installs: 1 };
    const { wrapper, settings } = await mountRow(pdf);
    // "pdf" is installed at the user level only.
    expect(wrapper.findAll(".btn-group button").map((button) => button.text())).toEqual(["Inspect", "Install"]);
    settings.skillsLevel = "user";
    await flushPromises();
    expect(wrapper.findAll(".btn-group button").map((button) => button.text())).toEqual(["Inspect", "Installed"]);
    expect(wrapper.findAll(".btn-group button")[1].attributes("disabled")).toBeDefined();
  });
});

describe("SkillSearchResultRow: inspect", () => {
  it("shows the SKILL.md file of the result before the installation", async () => {
    const { wrapper, skills } = await mountRow(RESULT, { skills_preview: "---\nname: docx\n---" });
    await wrapper.findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_preview", { source: "anthropics/skills", skillId: "docx" });
    expect(skills.skills.view?.text).toContain("name: docx");
    expect(skills.skills.view?.originLabel).toBe("skills.sh · anthropics/skills");
  });
});

describe("SkillSearchResultRow: install", () => {
  async function clickInstall(wrapper: Awaited<ReturnType<typeof mountRow>>["wrapper"]) {
    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();
  }

  it("installs at the chosen level, in the folder of the workspace", async () => {
    const { wrapper } = await mountRow();
    await clickInstall(wrapper);
    expect(invoke).toHaveBeenCalledWith("skills_install", {
      level: "workspace",
      cwd: "/work/heidrun",
      source: "anthropics/skills",
      skillId: "docx",
      agents: ["claude", "codex"],
    });
  });

  it("installs only for the agents that the user switched on", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: ["codex"] }));
    const { wrapper } = await mountRow();
    await clickInstall(wrapper);
    expect(invoke).toHaveBeenCalledWith("skills_install", expect.objectContaining({ agents: ["codex"] }));
  });

  it("does not install when no agent is switched on, and says what to do", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: [] }));
    const { wrapper, session } = await mountRow();
    await clickInstall(wrapper);
    expect(invoke).not.toHaveBeenCalledWith("skills_install", expect.anything());
    expect(session.state.toast).toBe("Switch on a coding agent in the section Agents first");
  });

  it("installs at the user level when the user chose it", async () => {
    const { wrapper, settings } = await mountRow();
    settings.skillsLevel = "user";
    await clickInstall(wrapper);
    expect(invoke).toHaveBeenCalledWith("skills_install", expect.objectContaining({ level: "user" }));
  });

  it("does not install at the workspace level without a workspace", async () => {
    const { wrapper, session } = await mountRow();
    session.state.selectedWorkspaceId = null;
    invoke.mockClear();
    await clickInstall(wrapper);
    expect(invoke).not.toHaveBeenCalledWith("skills_install", expect.anything());
    expect(session.state.toast).toBe("Select a workspace first, or choose the level User");
  });

  it("shows a spinner while the installation runs, and removes it at the notification", async () => {
    const install = pending();
    const { wrapper, session } = await mountRow(RESULT, { skills_install: install.promise });
    const button = () => wrapper.findAll("button")[1];
    expect(button().find(".spinner").exists()).toBe(false);
    await button().trigger("click");
    expect(button().find(".spinner").exists()).toBe(true);
    expect(button().find(".bi-download").exists()).toBe(false);
    expect(button().attributes("aria-busy")).toBe("true");
    expect(button().attributes("disabled")).toBeDefined();
    install.finish({});
    await flushPromises();
    expect(session.state.toast).toBe("Skill docx installed");
    expect(wrapper.find(".spinner").exists()).toBe(false);
  });

  it("removes the spinner when the installation fails", async () => {
    const { wrapper, session } = await mountRow();
    invoke.mockImplementation(async (command: string) => {
      if (command === "skills_install") {
        throw "skills_download_failed: timeout";
      }
      return INSTALLED;
    });
    await clickInstall(wrapper);
    expect(wrapper.find(".spinner").exists()).toBe(false);
    expect(session.state.toastKind).toBe("error");
  });
});

describe("SkillSearchResultRow: web address of a skill folder", () => {
  it("shows the name and the repository, with no number of installs", async () => {
    const { wrapper } = await mountRow(FOLDER_RESULT);
    expect(wrapper.get(".name").text()).toBe("pdf");
    expect(wrapper.get(".sub").text()).toBe("anthropics/skills · GitHub folder");
  });

  it("shows the SKILL.md file of the folder, with GitHub as its origin", async () => {
    const { wrapper, skills } = await mountRow(FOLDER_RESULT, { skills_preview_folder: "---\nname: pdf\n---" });
    await wrapper.findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_preview_folder", { url: FOLDER_URL });
    expect(invoke).not.toHaveBeenCalledWith("skills_preview", expect.anything());
    expect(skills.skills.view?.text).toContain("name: pdf");
    expect(skills.skills.view?.originLabel).toBe("GitHub · anthropics/skills");
  });

  it("installs the folder at the chosen level, for the agents that are switched on", async () => {
    const { wrapper, session } = await mountRow(FOLDER_RESULT);
    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_install_folder", {
      level: "workspace",
      cwd: "/work/heidrun",
      url: FOLDER_URL,
      agents: ["claude", "codex"],
    });
    expect(invoke).not.toHaveBeenCalledWith("skills_install", expect.anything());
    expect(session.state.toast).toBe("Skill pdf installed");
  });

  it("shows the error when the folder is not found or the repository is private", async () => {
    const { wrapper, session } = await mountRow(FOLDER_RESULT);
    invoke.mockImplementation(async (command: string) => {
      if (command === "skills_install_folder") {
        throw "skills_folder_not_found: anthropics/skills/main/skills/pdf";
      }
      return INSTALLED;
    });
    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();
    expect(session.state.toastKind).toBe("error");
    expect(session.state.toast).toBe(
      "This folder was not found: anthropics/skills/main/skills/pdf. The repository must be public, and the folder must have a SKILL.md file.",
    );
    expect(wrapper.find(".spinner").exists()).toBe(false);
  });
});

describe("SkillSearchResultRow: web address of a skill folder on GitLab", () => {
  it("shows the name and the project, with the words GitLab folder", async () => {
    const { wrapper } = await mountRow(GITLAB_RESULT);
    expect(wrapper.get(".name").text()).toBe("pdf");
    expect(wrapper.get(".sub").text()).toBe("acme/agent-skills · GitLab folder");
  });

  it("shows the SKILL.md file of the folder, with GitLab as its origin", async () => {
    const { wrapper, skills } = await mountRow(GITLAB_RESULT, { skills_preview_folder: "---\nname: pdf\n---" });
    await wrapper.findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_preview_folder", { url: GITLAB_URL });
    expect(skills.skills.view?.originLabel).toBe("GitLab · acme/agent-skills");
  });

  it("installs the folder with the command of the web addresses, like a folder on GitHub", async () => {
    const { wrapper } = await mountRow(GITLAB_RESULT);
    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_install_folder", {
      level: "workspace",
      cwd: "/work/heidrun",
      url: GITLAB_URL,
      agents: ["claude", "codex"],
    });
  });
});

describe("SkillSearchResultRow: local folder", () => {
  it("shows the name of the folder, its full path, and the words Local folder", async () => {
    const { wrapper } = await mountRow(LOCAL_RESULT);
    expect(wrapper.get(".name").text()).toBe("pdf");
    expect(wrapper.get(".sub").text()).toBe(`${LOCAL_PATH} · Local folder`);
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["Inspect", "Install"]);
  });

  it("shows the SKILL.md file of the folder, with Local folder as its origin", async () => {
    const { wrapper, skills } = await mountRow(LOCAL_RESULT, { skills_preview_local_folder: "---\nname: pdf\n---" });
    await wrapper.findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_preview_local_folder", { path: LOCAL_PATH });
    expect(invoke).not.toHaveBeenCalledWith("skills_preview", expect.anything());
    expect(skills.skills.view?.text).toContain("name: pdf");
    expect(skills.skills.view?.originLabel).toBe(`Local folder · ${LOCAL_PATH}`);
  });

  it("installs the folder at the chosen level, for the agents that are switched on", async () => {
    const { wrapper, session } = await mountRow(LOCAL_RESULT);
    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_install_local_folder", {
      level: "workspace",
      cwd: "/work/heidrun",
      path: LOCAL_PATH,
      agents: ["claude", "codex"],
    });
    expect(invoke).not.toHaveBeenCalledWith("skills_install", expect.anything());
    expect(invoke).not.toHaveBeenCalledWith("skills_install_folder", expect.anything());
    expect(session.state.toast).toBe("Skill pdf installed");
  });

  it("shows a skill as installed when a skill with the name of the folder is at the chosen level", async () => {
    const { wrapper, settings } = await mountRow(LOCAL_RESULT);
    expect(wrapper.findAll(".btn-group button").map((button) => button.text())).toEqual(["Inspect", "Install"]);
    settings.skillsLevel = "user";
    await flushPromises();
    expect(wrapper.findAll(".btn-group button").map((button) => button.text())).toEqual(["Inspect", "Installed"]);
  });

  it("shows the error when the folder has no SKILL.md file, and removes the spinner", async () => {
    const { wrapper, session } = await mountRow(LOCAL_RESULT);
    invoke.mockImplementation(async (command: string) => {
      if (command === "skills_install_local_folder") {
        throw `skills_local_folder_no_skill_file: ${LOCAL_PATH}`;
      }
      return INSTALLED;
    });
    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();
    expect(session.state.toastKind).toBe("error");
    expect(session.state.toast).toBe(`This folder has no SKILL.md file: ${LOCAL_PATH}`);
    expect(wrapper.find(".spinner").exists()).toBe(false);
  });
});

describe("SkillSearchResultRow: comparison with the installed skill", () => {
  /** A result of skills.sh named like the skill `pdf`, which is installed at the user level. */
  const PDF = { source: "anthropics/skills", skillId: "pdf", name: "pdf", installs: 1 };

  async function mountInstalledRow(answers: Record<string, unknown>) {
    const mounted = await mountRow(PDF, answers);
    mounted.settings.skillsLevel = "user";
    await flushPromises();
    return mounted;
  }

  it("shows a small badge Different at the left of the buttons, and the button Install, when the SKILL.md file is not the same", async () => {
    const { wrapper } = await mountInstalledRow({ skills_preview: "# pdf\nnew way", skills_read: "# pdf\nold way" });
    expect(invoke).toHaveBeenCalledWith("skills_read", { level: "user", cwd: "/work/heidrun", name: "pdf" });
    const badge = wrapper.get(".differentBadge");
    expect(badge.text()).toBe("Different");
    expect(badge.attributes("title")).toContain("Click Inspect");
    expect(wrapper.find(".nameLine .differentBadge").exists()).toBe(false);
    expect(badge.element.nextElementSibling).toBe(wrapper.get(".rowActions").element);
    expect(wrapper.findAll(".btn-group button").map((button) => button.text())).toEqual(["Inspect", "Install"]);
    expect(wrapper.findAll(".btn-group button")[1].attributes("disabled")).toBeUndefined();
  });

  it("shows no badge and the disabled button Installed when the SKILL.md file is the same, even with other line ends", async () => {
    const { wrapper } = await mountInstalledRow({ skills_preview: "# pdf\r\nsame way\r\n", skills_read: "# pdf\nsame way\n" });
    expect(wrapper.find(".differentBadge").exists()).toBe(false);
    expect(wrapper.findAll(".btn-group button").map((button) => button.text())).toEqual(["Inspect", "Installed"]);
  });

  it("shows no badge when one of the two files cannot be read", async () => {
    const { wrapper } = await mountRow(PDF, { skills_preview: "# pdf" });
    invoke.mockImplementation(async (command: string) => {
      if (command === "skills_read") {
        throw "skills_not_installed: pdf";
      }
      return "# pdf";
    });
    (await import("../../stores/settings")).settings.skillsLevel = "user";
    await flushPromises();
    expect(wrapper.find(".differentBadge").exists()).toBe(false);
    expect(wrapper.findAll(".btn-group button").map((button) => button.text())).toEqual(["Inspect", "Installed"]);
  });

  it("reads nothing for a skill that is not installed at the chosen level", async () => {
    await mountRow(RESULT, { skills_preview: "# docx" });
    await flushPromises();
    expect(invoke).not.toHaveBeenCalledWith("skills_read", expect.anything());
  });

  it("gives the text of the installed skill to the window of the SKILL.md file when the user inspects it", async () => {
    const { wrapper, skills } = await mountInstalledRow({ skills_preview: "# pdf\nnew way", skills_read: "# pdf\nold way" });
    await wrapper.findAll(".btn-group button")[0].trigger("click");
    await flushPromises();
    expect(skills.skills.view?.text).toBe("# pdf\nnew way");
    expect(skills.skills.view?.installedText).toBe("# pdf\nold way");
  });

  it("gives no text of an installed skill for a result that is not installed", async () => {
    const { wrapper, skills } = await mountRow(RESULT, { skills_preview: "# docx" });
    await wrapper.findAll(".btn-group button")[0].trigger("click");
    await flushPromises();
    expect(skills.skills.view?.installedText).toBeUndefined();
  });

  it("replaces the installed skill with the different one: confirmation, then the Trash, then the installation", async () => {
    const { wrapper, session } = await mountInstalledRow({ skills_preview: "# pdf\nnew way", skills_read: "# pdf\nold way" });
    const confirm = await import("../../stores/confirm");
    invoke.mockClear();
    await wrapper.findAll(".btn-group button")[1].trigger("click");
    expect(confirm.confirmDialog.title).toBe("Replace the installed skill pdf with this one? The installed skill moves to the Trash.");
    expect(confirm.confirmDialog.confirmLabel).toBe("Replace");
    expect(invoke).not.toHaveBeenCalledWith("skills_delete", expect.anything());
    confirm.answerConfirm(true);
    await flushPromises();
    const commands = invoke.mock.calls.map((call) => call[0]);
    expect(commands.indexOf("skills_delete")).toBeGreaterThanOrEqual(0);
    expect(commands.indexOf("skills_delete")).toBeLessThan(commands.indexOf("skills_install"));
    expect(invoke).toHaveBeenCalledWith("skills_delete", { level: "user", cwd: "/work/heidrun", name: "pdf" });
    expect(invoke).toHaveBeenCalledWith("skills_install", expect.objectContaining({ level: "user", skillId: "pdf" }));
    expect(session.state.toast).toBe("Skill pdf replaced");
  });

  it("replaces nothing when the developer cancels the confirmation", async () => {
    const { wrapper } = await mountInstalledRow({ skills_preview: "# pdf\nnew way", skills_read: "# pdf\nold way" });
    const confirm = await import("../../stores/confirm");
    invoke.mockClear();
    await wrapper.findAll(".btn-group button")[1].trigger("click");
    confirm.answerConfirm(false);
    await flushPromises();
    expect(invoke).not.toHaveBeenCalledWith("skills_delete", expect.anything());
    expect(invoke).not.toHaveBeenCalledWith("skills_install", expect.anything());
  });

  it("says that the previous version is in the Trash when the installation fails after the removal", async () => {
    const { wrapper, session } = await mountInstalledRow({ skills_preview: "# pdf\nnew way", skills_read: "# pdf\nold way" });
    const confirm = await import("../../stores/confirm");
    invoke.mockImplementation(async (command: string) => {
      if (command === "skills_install") {
        throw "skills_download_failed: timeout";
      }
      return command === "skills_list" ? [] : "# pdf";
    });
    await wrapper.findAll(".btn-group button")[1].trigger("click");
    confirm.answerConfirm(true);
    await flushPromises();
    expect(session.state.toast).toBe("The download failed: timeout The previous version of the skill is in the Trash.");
  });
});

describe("SkillSearchResultRow: the card of the circled question mark", () => {
  const PDF = { source: "anthropics/skills", skillId: "pdf", name: "pdf", installs: 1 };
  const TEXT = "---\nname: pdf-reader\ndescription: Read and fill PDF files.\n---\n# pdf";

  async function clickQuestionMark(wrapper: Awaited<ReturnType<typeof mountRow>>["wrapper"]) {
    await wrapper.get(".information-card-part").trigger("click");
    await flushPromises();
  }

  it("has the circled question mark on the line of the name, after the name", async () => {
    const { wrapper } = await mountRow(PDF);
    const line = wrapper.get(".nameLine");
    expect(line.element.children[0].textContent).toBe("pdf");
    expect(line.find(".infoPart .bi-question-circle").exists()).toBe(true);
  });

  it("reads nothing and opens nothing before the click, even when the pointer is over the circled question mark", async () => {
    const { wrapper } = await mountRow(PDF, { skills_preview: TEXT });
    await wrapper.get(".information-card-part").trigger("pointerenter");
    await wrapper.get(".information-card-part").trigger("mouseenter");
    await flushPromises();
    expect(invoke).not.toHaveBeenCalledWith("skills_preview", expect.anything());
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("shows the name, the description, and the place of the skill after a click", async () => {
    const { wrapper } = await mountRow(PDF, { skills_preview: TEXT });
    await clickQuestionMark(wrapper);
    const card = wrapper.get(".popover");
    expect(card.text()).toContain("pdf-reader");
    expect(card.text()).toContain("Read and fill PDF files.");
    expect(card.text()).toContain("anthropics/skills");
  });

  it("closes the card with a second click", async () => {
    const { wrapper } = await mountRow(PDF, { skills_preview: TEXT });
    await clickQuestionMark(wrapper);
    await clickQuestionMark(wrapper);
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("says that the skill is installed with another SKILL.md file when it is", async () => {
    const { wrapper, settings } = await mountRow(PDF, { skills_preview: TEXT, skills_read: "# old" });
    settings.skillsLevel = "user";
    await flushPromises();
    await clickQuestionMark(wrapper);
    expect(wrapper.get(".popover").text()).toContain("another SKILL.md file");
  });

  it("says that the skill has no description when its SKILL.md file has none", async () => {
    const { wrapper } = await mountRow(PDF, { skills_preview: "# pdf only" });
    await clickQuestionMark(wrapper);
    expect(wrapper.get(".popover").text()).toContain("This skill has no description in its SKILL.md file.");
  });

  it("says that the file could not be read when the backend fails", async () => {
    const { wrapper } = await mountRow(PDF);
    invoke.mockImplementation(async () => {
      throw "skills_download_failed: timeout";
    });
    await clickQuestionMark(wrapper);
    expect(wrapper.get(".popover").text()).toContain("The SKILL.md file of this skill could not be read.");
  });
});

describe("SkillSearchResultRow: the path of a row that is too long", () => {
  const PDF = { source: "anthropics/skills", skillId: "pdf", name: "pdf", installs: 1 };

  /** Gives the line of the place a width of 100 pixels for `textWidth` pixels of text. */
  function makeLineTooLong(line: HTMLElement, textWidth = 340) {
    Object.defineProperty(line, "scrollWidth", { configurable: true, value: textWidth });
    Object.defineProperty(line, "clientWidth", { configurable: true, value: 100 });
  }

  it("scrolls from the right to the left, to the end of the path, with a CSS transition while the pointer is over the row", async () => {
    const { wrapper } = await mountRow(PDF);
    const line = wrapper.get(".sub");
    makeLineTooLong(line.element as HTMLElement);
    expect(line.find(".subText").text()).toBe("anthropics/skills · 1 installs");
    await wrapper.get(".row").trigger("pointerenter");
    expect(line.classes()).toContain("scrolling");
    expect((line.element as HTMLElement).style.getPropertyValue("--scroll-distance")).toBe("-240px");
    expect((line.element as HTMLElement).style.getPropertyValue("--scroll-duration")).toBe("2880ms");
  });

  it("puts the path back at its start when the pointer leaves the row", async () => {
    const { wrapper } = await mountRow(PDF);
    const line = wrapper.get(".sub");
    makeLineTooLong(line.element as HTMLElement);
    await wrapper.get(".row").trigger("pointerenter");
    expect(line.classes()).toContain("scrolling");
    await wrapper.get(".row").trigger("pointerleave");
    expect(line.classes()).not.toContain("scrolling");
  });

  it("scrolls nothing when the whole path fits in the row", async () => {
    const { wrapper } = await mountRow(PDF);
    const line = wrapper.get(".sub");
    makeLineTooLong(line.element as HTMLElement, 100);
    await wrapper.get(".row").trigger("pointerenter");
    expect(line.classes()).not.toContain("scrolling");
  });
});
