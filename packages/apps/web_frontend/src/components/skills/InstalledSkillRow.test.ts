import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { INSTALLED, pending, prepare } from "./skills_test_support";

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

async function mountRow(index: number) {
  const prepared = await prepare(invoke);
  const { default: InstalledSkillRow } = await import("./InstalledSkillRow.vue");
  return { wrapper: mount(InstalledSkillRow, { props: { skill: prepared.skills.skills.installed[index] } }), ...prepared };
}

/** The buttons "Add link" of a row. */
function linkButtons(wrapper: Awaited<ReturnType<typeof mountRow>>["wrapper"]) {
  return wrapper.findAll("button").filter((button) => button.text().startsWith("Add link"));
}

describe("InstalledSkillRow: display", () => {
  it("shows the name, the origin and the place", async () => {
    const { wrapper } = await mountRow(0);
    expect(wrapper.get(".name").text()).toBe("pdf");
    expect(wrapper.get(".sub").text()).toBe("skills.sh · anthropics/skills · Claude Code · Codex");
    expect(wrapper.get(".place").text()).toBe("User");
  });

  it("shows Local for a skill that Heidrun Code did not install", async () => {
    const { wrapper } = await mountRow(1);
    expect(wrapper.get(".sub").text()).toBe("Local · Codex");
    expect(wrapper.get(".place").text()).toBe("Workspace");
  });

  it("does not show an agent that the user did not switch on", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: ["claude"] }));
    const { wrapper } = await mountRow(0);
    expect(wrapper.get(".sub").text()).toBe("skills.sh · anthropics/skills · Claude Code");
  });

  it("shows an icon before the text of the buttons Inspect and Delete", async () => {
    const { wrapper } = await mountRow(0);
    const buttons = wrapper.findAll("button");
    expect(buttons[0].find(".bi-eye").exists()).toBe(true);
    expect(buttons[1].find(".bi-trash").exists()).toBe(true);
  });
});

describe("InstalledSkillRow: link for an agent switched on later", () => {
  it("shows a button for the agent that is switched on and lacks the skill", async () => {
    expect(linkButtons((await mountRow(0)).wrapper)).toHaveLength(0);
    const buttons = linkButtons((await mountRow(1)).wrapper);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text()).toBe("Add link for Claude Code");
  });

  it("shows no button for an agent that the user did not switch on", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: ["codex"] }));
    expect(linkButtons((await mountRow(1)).wrapper)).toHaveLength(0);
  });

  it("shows a button for every switched on agent when none has the skill", async () => {
    const orphan = { name: "orphan", description: "", level: "user", origin: null, path: "/x", agents: [] };
    await prepare(invoke, { skills_list: [orphan] });
    const { default: InstalledSkillRow } = await import("./InstalledSkillRow.vue");
    const { skills } = await import("../../stores/skills");
    const wrapper = mount(InstalledSkillRow, { props: { skill: skills.installed[0] } });
    expect(linkButtons(wrapper).map((button) => button.text())).toEqual(["Add link for Claude Code", "Add link for Codex"]);
  });

  it("adds the link at the level of the skill, and says it in a notification", async () => {
    const { wrapper, session } = await mountRow(1);
    await linkButtons(wrapper)[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_link_agent", {
      level: "workspace",
      cwd: "/work/heidrun",
      name: "release-notes",
      agent: "claude",
    });
    expect(session.state.toast).toBe("Skill release-notes linked for Claude Code");
  });

  it("shows a spinner while the link is added, and shows the error when it fails", async () => {
    const { wrapper, session } = await mountRow(1);
    let fail: (error: string) => void = () => {};
    invoke.mockImplementation(async (command: string) => {
      if (command === "skills_link_agent") {
        return new Promise((_resolve, reject) => {
          fail = reject;
        });
      }
      return command === "skills_list" ? INSTALLED : [];
    });
    const button = linkButtons(wrapper)[0];
    await button.trigger("click");
    expect(button.find(".spinner").exists()).toBe(true);
    expect(button.attributes("disabled")).toBeDefined();
    fail("skills_already_linked: release-notes");
    await flushPromises();
    expect(button.find(".spinner").exists()).toBe(false);
    expect(session.state.toast).toBe("The skill release-notes is already in the folder of this agent");
    expect(session.state.toastKind).toBe("error");
  });
});

describe("InstalledSkillRow: inspect and delete", () => {
  it("opens the SKILL.md file of the skill, read at its own level", async () => {
    const { wrapper, skills } = await mountRow(1);
    invoke.mockImplementation(async (command: string) => (command === "skills_read" ? "# Release notes" : []));
    await wrapper.findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_read", { level: "workspace", cwd: "/work/heidrun", name: "release-notes" });
    expect(skills.skills.view).toEqual({ name: "release-notes", originLabel: "Local", text: "# Release notes", loading: false });
  });

  it("deletes only after the confirmation", async () => {
    const { wrapper } = await mountRow(0);
    const confirm = await import("../../stores/confirm");
    await wrapper.get(".danger").trigger("click");
    expect(confirm.confirmDialog.open).toBe(true);
    expect(confirm.confirmDialog.title).toBe("Move the skill pdf to the Trash?");
    expect(invoke).not.toHaveBeenCalledWith("skills_delete", expect.anything());
    confirm.answerConfirm(true);
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_delete", { level: "user", cwd: "/work/heidrun", name: "pdf" });
  });

  it("keeps the skill when the user cancels", async () => {
    const { wrapper } = await mountRow(0);
    const confirm = await import("../../stores/confirm");
    await wrapper.get(".danger").trigger("click");
    confirm.answerConfirm(false);
    await flushPromises();
    expect(invoke).not.toHaveBeenCalledWith("skills_delete", expect.anything());
  });

  it("shows a spinner in the button Delete while the deletion runs, and removes it at the notification", async () => {
    const deletion = pending();
    const { wrapper, session } = await mountRow(0);
    invoke.mockImplementation(async (command: string) => (command === "skills_delete" ? deletion.promise : INSTALLED));
    const confirm = await import("../../stores/confirm");
    const button = () => wrapper.get(".danger");
    await button().trigger("click");
    confirm.answerConfirm(true);
    await flushPromises();
    expect(button().find(".spinner").exists()).toBe(true);
    expect(button().find(".bi-trash").exists()).toBe(false);
    deletion.finish(undefined);
    await flushPromises();
    expect(session.state.toast).toBe("Skill pdf moved to the Trash");
    expect(wrapper.find(".spinner").exists()).toBe(false);
  });
});
