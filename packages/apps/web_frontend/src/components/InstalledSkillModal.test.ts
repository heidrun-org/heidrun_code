import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { prepare } from "./skills/skills_test_support";

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

/** Mounts the window on a selected workspace. The loading of the skills is the job of the window itself. */
async function mountWindow() {
  const prepared = await prepare(invoke);
  invoke.mockClear();
  const { default: InstalledSkillModal } = await import("./InstalledSkillModal.vue");
  const wrapper = mount(InstalledSkillModal);
  await flushPromises();
  return { wrapper, ...prepared };
}

describe("InstalledSkillModal", () => {
  it("asks for the skills of the folder of the selected workspace", async () => {
    await mountWindow();
    expect(invoke).toHaveBeenCalledWith("skills_list", { cwd: "/work/heidrun" });
  });

  it("shows a question mark with the help text next to the title", async () => {
    const { wrapper } = await mountWindow();
    expect(wrapper.get("h2").text()).toBe("Installed skill");
    const button = wrapper.get(".helpButton");
    expect(button.attributes("aria-label")).toBe("What is this window about?");
    const tip = wrapper.get('[role="tooltip"]');
    expect(button.attributes("aria-describedby")).toBe(tip.attributes("id"));
    expect(tip.text()).toContain("SKILL.md");
  });

  it("closes the window with the close button", async () => {
    const { wrapper } = await mountWindow();
    const { installedSkillModal } = await import("../stores/skills");
    installedSkillModal.open = true;
    await wrapper.get(".close").trigger("click");
    expect(installedSkillModal.open).toBe(false);
  });

  it("shows one row for each installed skill, with the buttons Inspect and Delete", async () => {
    const { wrapper } = await mountWindow();
    const rows = wrapper.findAll(".list .row");
    expect(rows).toHaveLength(2);
    expect(rows[0].findAll("button").map((button) => button.text())).toContain("Inspect");
    expect(rows[0].findAll("button").map((button) => button.text())).toContain("Delete");
  });

	it('filters installed skills with two independent checkboxes selected by default', async () => {
		const { wrapper } = await mountWindow();
		const group = wrapper.get('[aria-label="Filter installed skills"]');
		const [user, workflow] = group.findAll('label');
		expect(user.text()).toBe('User');
		expect(workflow.text()).toBe('Workflow');

		const userInput = user.get<HTMLInputElement>('input[type="checkbox"]');
		const workflowInput = workflow.get<HTMLInputElement>('input[type="checkbox"]');
		expect(userInput.element.checked).toBe(true);
		expect(workflowInput.element.checked).toBe(true);
		expect(wrapper.findAll('.list .row')).toHaveLength(2);

		await userInput.setValue(false);
		expect(wrapper.findAll('.list .row')).toHaveLength(1);
		expect(wrapper.get('.list .row').text()).toContain('release-notes');

		await workflowInput.setValue(false);
		expect(wrapper.find('.list .row').exists()).toBe(false);
		expect(wrapper.text()).toContain('No installed skills match the selected filters.');

		await userInput.setValue(true);
		expect(wrapper.findAll('.list .row')).toHaveLength(1);
		expect(wrapper.get('.list .row').text()).toContain('pdf');

		await workflowInput.setValue(true);
		expect(wrapper.findAll('.list .row')).toHaveLength(2);
	});

  it("shows no level switch, no notice, and no search", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ ownedAgents: [] }));
    const { wrapper } = await mountWindow();
    expect(wrapper.find(".levelChoice").exists()).toBe(false);
    expect(wrapper.find(".notice").exists()).toBe(false);
    expect(wrapper.find(".search").exists()).toBe(false);
  });

  it("loads the skills again when another workspace is selected", async () => {
    const { session } = await mountWindow();
    session.state.snapshot = {
      ...session.state.snapshot,
      workspaces: [
        ...(session.state.snapshot?.workspaces ?? []),
        { workspace_id: "w2", number: 2, label: "other", agent_status: "idle", workspace_folder: "/work/other" },
      ],
    } as typeof session.state.snapshot;
    invoke.mockClear();
    session.state.selectedWorkspaceId = "w2";
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("skills_list", { cwd: "/work/other" });
  });
});
