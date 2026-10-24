import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  document.body.innerHTML = "";
});

/** Mounts the window Create a custom launcher, open, on a workspace that has one custom launcher. */
async function mountNewCustomLauncherModal() {
  const { state } = await import("../stores/session");
  const { project } = await import("../stores/project");
  const { newCustomLauncherModal } = await import("../stores/newCustomLauncher");
  const { default: NewCustomLauncherModal } = await import("./NewCustomLauncherModal.vue");
  state.selectedWorkspaceId = "w1";
  project.byWorkspace["w1"] = {
    root: "/Users/me/webwork/heidrun",
    config_path: "/Users/me/webwork/heidrun/.heidrun/config.json",
    config: {
      version: 1,
      launchers: [{ id: "dev", label: "start the server", command: "make dev" }],
    },
    detected: [],
  } as never;
  newCustomLauncherModal.open = true;
  const wrapper = mount(NewCustomLauncherModal, { attachTo: document.body });
  await flushPromises();
  return { wrapper, project, newCustomLauncherModal };
}

/**
 * Makes the fake file launchers.json answer, and reads it once, before the window opens.
 * @param launchers - The user level launchers that the file holds.
 * @returns The lists that the window wrote to the file, one list for each write.
 */
async function useUserLaunchersFile(launchers: unknown[] = []) {
  const { invoke } = await import("@tauri-apps/api/core");
  const writes: unknown[][] = [];
  vi.mocked(invoke).mockImplementation((async (command: string, args?: { launchers?: unknown[] }) => {
    if (command === "launchers_user_read") {
      return { exists: true, launchers, error: null };
    }
    if (command === "launchers_user_write") {
      writes.push(args?.launchers ?? []);
    }
    return null;
  }) as never);
  const { UserLaunchers } = await import("../stores/user_launchers");
  await UserLaunchers.readOnce();
  return writes;
}

/** Opens the window on the custom launcher `id`, after the project is set up by a first window that is closed again. */
async function mountEditingWindow(id: string) {
  const first = await mountNewCustomLauncherModal();
  first.wrapper.unmount();
  document.body.innerHTML = "";
  const { newCustomLauncherModal } = await import("../stores/newCustomLauncher");
  const { default: NewCustomLauncherModal } = await import("./NewCustomLauncherModal.vue");
  newCustomLauncherModal.editedId = id;
  newCustomLauncherModal.open = true;
  const wrapper = mount(NewCustomLauncherModal, { attachTo: document.body });
  await flushPromises();
  return { wrapper, project: first.project };
}

describe("NewCustomLauncherModal", () => {
  it("is called Create a custom launcher", async () => {
    const { wrapper } = await mountNewCustomLauncherModal();
    expect(wrapper.get("h2").text()).toBe("Create a custom launcher");
    expect(wrapper.get("[role=dialog]").attributes("aria-label")).toBe("Create a custom launcher");
  });

  it("has the kind as radio buttons, then the name, then the command line", async () => {
    const { wrapper } = await mountNewCustomLauncherModal();
    const radios = wrapper.findAll("input[type=radio]");
    expect(radios.map((radio) => radio.attributes("value"))).toEqual(["commandLine", "codingAgent", "user", "workspace"]);
    expect(wrapper.get("label[for=new-launcher-name]").text()).toBe("Name");
    expect(wrapper.get("label[for=new-launcher-command]").text()).toBe("Command line");
    expect(wrapper.get("label[for=new-launcher-name]").text()).not.toContain("optional");
  });

  it("has the level after the kind: the buttons User and Workspace, with the workspace level chosen first", async () => {
    await useUserLaunchersFile();
    const { wrapper } = await mountNewCustomLauncherModal();
    const levelButtons = wrapper.findAll("input[data-launcher-level]");
    expect(levelButtons.map((button) => button.attributes("value"))).toEqual(["user", "workspace"]);
    expect(wrapper.text()).toContain("Level");
    expect(wrapper.text()).toContain("User");
    expect(wrapper.text()).toContain("Workspace");
    expect((wrapper.get("input[data-launcher-level=workspace]").element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.get("input[data-launcher-level=user]").element as HTMLInputElement).checked).toBe(false);
    const text = wrapper.text();
    expect(text.indexOf("Kind")).toBeLessThan(text.indexOf("Level"));
    expect(text.indexOf("Level")).toBeLessThan(text.indexOf("Name"));
  });

  it("says where the custom launcher shows, for the chosen level", async () => {
    await useUserLaunchersFile();
    const { wrapper } = await mountNewCustomLauncherModal();
    expect(wrapper.get("[data-launcher-level-hint]").text()).toContain("shows only in the workspace");
    await wrapper.get("input[data-launcher-level=user]").setValue(true);
    expect(wrapper.get("[data-launcher-level-hint]").text()).toContain("shows in every workspace");
    await wrapper.get("input[data-launcher-level=workspace]").setValue(true);
    expect(wrapper.get("[data-launcher-level-hint]").text()).toContain("shows only in the workspace");
  });

  it("creates a custom launcher of the workspace level in the project, and writes nothing to the file of the user level", async () => {
    const writes = await useUserLaunchersFile();
    const { wrapper, project } = await mountNewCustomLauncherModal();
    await wrapper.get("#new-launcher-name").setValue("only here");
    await wrapper.get("#new-launcher-command").setValue("make here");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers.map((launcher) => launcher.label)).toEqual(["start the server", "only here"]);
    expect(writes).toEqual([]);
  });

  it("creates a custom launcher of the user level in the file of the user level, and not in the project", async () => {
    const writes = await useUserLaunchersFile([{ id: "old", label: "old one", command: "make old" }]);
    const { wrapper, project, newCustomLauncherModal } = await mountNewCustomLauncherModal();
    await wrapper.get("input[data-launcher-level=user]").setValue(true);
    await wrapper.get("#new-launcher-name").setValue("everywhere");
    await wrapper.get("#new-launcher-command").setValue("make everywhere");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers).toHaveLength(1);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toHaveLength(2);
    expect(writes[0][1]).toMatchObject({ label: "everywhere", command: "make everywhere" });
    expect(newCustomLauncherModal.open).toBe(false);
  });

  it("creates a custom launcher of the user level of the kind Coding agent, with its folder", async () => {
    const writes = await useUserLaunchersFile();
    const { wrapper } = await mountNewCustomLauncherModal();
    await wrapper.get("input[data-launcher-level=user]").setValue(true);
    await wrapper.get("input[name=new-launcher-kind][value=codingAgent]").setValue(true);
    await wrapper.get("#new-launcher-name").setValue("review");
    await wrapper.get("#new-launcher-folder").setValue("web");
    await wrapper.get("#new-launcher-prompt").setValue("Review the last commit.");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toMatchObject({ label: "review", cwd: "web", agent: { prompt: "Review the last commit." } });
  });

  it("edits a custom launcher of the user level: the level User is chosen, and the change stays in the file", async () => {
    const writes = await useUserLaunchersFile([{ id: "u1", label: "everywhere", command: "make everywhere" }]);
    const { wrapper, project } = await mountEditingWindow("u1");
    expect((wrapper.get("input[data-launcher-level=user]").element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.get("#new-launcher-name").element as HTMLInputElement).value).toBe("everywhere");
    await wrapper.get("#new-launcher-name").setValue("everywhere now");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(writes).toEqual([[{ id: "u1", label: "everywhere now", command: "make everywhere" }]]);
    expect(project.byWorkspace["w1"]!.config.launchers).toHaveLength(1);
  });

  it("moves a custom launcher of the workspace level to the user level when the person chooses User", async () => {
    const writes = await useUserLaunchersFile();
    const { wrapper, project } = await mountEditingWindow("dev");
    expect((wrapper.get("input[data-launcher-level=workspace]").element as HTMLInputElement).checked).toBe(true);
    await wrapper.get("input[data-launcher-level=user]").setValue(true);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(writes).toEqual([[{ id: "dev", label: "start the server", command: "make dev" }]]);
    expect(project.byWorkspace["w1"]!.config.launchers).toEqual([]);
  });

  it("moves a custom launcher of the user level to the workspace level when the person chooses Workspace", async () => {
    const writes = await useUserLaunchersFile([{ id: "u1", label: "everywhere", command: "make everywhere" }]);
    const { wrapper, project } = await mountEditingWindow("u1");
    await wrapper.get("input[data-launcher-level=workspace]").setValue(true);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers.map((launcher) => launcher.id)).toEqual(["dev", "u1"]);
    expect(writes).toEqual([[]]);
  });

  it("puts the focus in the name field", async () => {
    const { wrapper } = await mountNewCustomLauncherModal();
    expect(document.activeElement).toBe(wrapper.get("#new-launcher-name").element);
  });

  it("does not allow Create while the name or the command line is empty", async () => {
    const { wrapper } = await mountNewCustomLauncherModal();
    const create = wrapper.get("button[type=submit]");
    expect(create.attributes("disabled")).toBeDefined();
    await wrapper.get("#new-launcher-name").setValue("my name");
    expect(create.attributes("disabled")).toBeDefined();
    await wrapper.get("#new-launcher-command").setValue("   ");
    expect(create.attributes("disabled")).toBeDefined();
    await wrapper.get("#new-launcher-command").setValue("make dev");
    expect(create.attributes("disabled")).toBeUndefined();
    await wrapper.get("#new-launcher-name").setValue("  ");
    expect(create.attributes("disabled")).toBeDefined();
  });

  it("creates the launcher with the name that the person gave", async () => {
    const { wrapper, project, newCustomLauncherModal } = await mountNewCustomLauncherModal();
    await wrapper.get("#new-launcher-name").setValue("  build all  ");
    await wrapper.get("#new-launcher-command").setValue("pnpm -r build");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const launchers = project.byWorkspace["w1"]!.config.launchers;
    expect(launchers).toHaveLength(2);
    expect(launchers[1]).toMatchObject({ label: "build all", command: "pnpm -r build" });
    expect(launchers[1].agent).toBeUndefined();
    expect(newCustomLauncherModal.open).toBe(false);
  });

  it("saves the description of several lines, and no description when it is empty", async () => {
    const { wrapper, project } = await mountNewCustomLauncherModal();
    await wrapper.get("#new-launcher-name").setValue("with");
    await wrapper.get("#new-launcher-description").setValue("  line one\nline two  ");
    await wrapper.get("textarea#new-launcher-command").setValue("make a");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers[1].description).toBe("line one\nline two");
  });

  it("keeps the lines of a command line of several lines", async () => {
    const { wrapper, project } = await mountNewCustomLauncherModal();
    await wrapper.get("#new-launcher-name").setValue("install and start");
    await wrapper.get("#new-launcher-command").setValue("cd web\npnpm install\npnpm dev");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers[1].command).toBe("cd web\npnpm install\npnpm dev");
  });

  it("creates the launcher when the person presses the key Command and Enter in the text area", async () => {
    const { wrapper, project } = await mountNewCustomLauncherModal();
    await wrapper.get("#new-launcher-name").setValue("test");
    await wrapper.get("#new-launcher-command").setValue("make test");
    await wrapper.get("#new-launcher-command").trigger("keydown", { key: "Enter", metaKey: true });
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers[1].command).toBe("make test");
  });

  it("shows the fields of the coding agent when the person chooses the kind Coding agent", async () => {
    const { wrapper } = await mountNewCustomLauncherModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    expect(wrapper.find("#new-launcher-command").exists()).toBe(false);
    expect(wrapper.findAll("input[name=new-launcher-agent]").map((radio) => radio.attributes("value"))).toEqual(["claude", "codex", "agy"]);
    for (const id of ["folder", "model", "effort", "prompt"]) {
      expect(wrapper.find(`#new-launcher-${id}`).exists()).toBe(true);
    }
  });

  it("creates a launcher of the kind Coding agent, with the command line that starts the agent", async () => {
    const { wrapper, project, newCustomLauncherModal } = await mountNewCustomLauncherModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("#new-launcher-name").setValue("review");
    await wrapper.get("input[name=new-launcher-agent][value=claude]").setValue();
    await wrapper.get("#new-launcher-folder").setValue("packages/apps");
    await wrapper.get("#new-launcher-model").setValue("opus");
    await wrapper.get("#new-launcher-effort").setValue("high");
    await wrapper.get("#new-launcher-prompt").setValue("Review the last commit.");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const launcher = project.byWorkspace["w1"]!.config.launchers[1];
    expect(launcher).toMatchObject({
      label: "review",
      cwd: "packages/apps",
      command: "claude --model 'opus' --effort 'high' 'Review the last commit.'",
      agent: { name: "claude", model: "opus", effort: "high", prompt: "Review the last commit." },
    });
    expect(newCustomLauncherModal.open).toBe(false);
  });

  it("puts the folder that the native picker returns in the field, relative to the root of the repository", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    vi.mocked(open).mockResolvedValueOnce("/Users/me/webwork/heidrun/packages/apps" as never);
    const { wrapper } = await mountNewCustomLauncherModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("button[aria-label='Choose the current work directory']").trigger("click");
    await flushPromises();
    expect((wrapper.get("#new-launcher-folder").element as HTMLInputElement).value).toBe("packages/apps");
  });

  it("refuses a folder outside the repository", async () => {
    const { wrapper } = await mountNewCustomLauncherModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("#new-launcher-name").setValue("review");
    await wrapper.get("#new-launcher-prompt").setValue("Hi");
    await wrapper.get("#new-launcher-folder").setValue("/etc");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
    await wrapper.get("#new-launcher-folder").setValue("../other");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
    await wrapper.get("#new-launcher-folder").setValue("/Users/me/webwork/heidrun/docs");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeUndefined();
  });

  it("does not allow Create for the kind Coding agent while the prompt is empty", async () => {
    const { wrapper } = await mountNewCustomLauncherModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("#new-launcher-name").setValue("review");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
    await wrapper.get("#new-launcher-prompt").setValue("Hi");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeUndefined();
  });

  /** Mocks the answer of the coding agent, and returns the click on the button that writes the empty fields. */
  async function mockAnswerAndMount(answerText: string) {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockClear();
    vi.mocked(invoke).mockImplementation((async (command: string) => {
      return command === "coding_agent_ask" ? { text: answerText } : null;
    }) as never);
    const mounted = await mountNewCustomLauncherModal();
    const button = mounted.wrapper.get("button[aria-label^='Write the empty fields']");
    return { ...mounted, button, invoke };
  }

  it("writes the name and the description when both are empty", async () => {
    const { wrapper, button, invoke } = await mockAnswerAndMount('Sure: {"name": " Start the server\\nx", "description": "Starts it."}');
    await wrapper.get("#new-launcher-command").setValue("make dev");
    await button.trigger("click");
    await flushPromises();
    const call = vi.mocked(invoke).mock.calls.find((c) => c[0] === "coding_agent_ask");
    expect((call?.[1] as { prompt: string }).prompt).toContain("make dev");
    expect((call?.[1] as { prompt: string }).prompt).toContain('"name", "description"');
    expect((wrapper.get("#new-launcher-name").element as HTMLInputElement).value).toBe("Start the server");
    expect((wrapper.get("#new-launcher-description").element as HTMLTextAreaElement).value).toBe("Starts it.");
  });

  it("writes only the description when the name is filled, and keeps the name", async () => {
    const { wrapper, button, invoke } = await mockAnswerAndMount('{"description": "Starts it."}');
    await wrapper.get("#new-launcher-name").setValue("my name");
    await wrapper.get("#new-launcher-command").setValue("make dev");
    await button.trigger("click");
    await flushPromises();
    const call = vi.mocked(invoke).mock.calls.find((c) => c[0] === "coding_agent_ask");
    expect((call?.[1] as { prompt: string }).prompt).toContain('are: "description".');
    expect((wrapper.get("#new-launcher-name").element as HTMLInputElement).value).toBe("my name");
    expect((wrapper.get("#new-launcher-description").element as HTMLTextAreaElement).value).toBe("Starts it.");
  });

  it("does nothing, and says so, when the name and the description are both filled", async () => {
    const { wrapper, button, invoke } = await mockAnswerAndMount('{"name": "x", "description": "y"}');
    await wrapper.get("#new-launcher-name").setValue("my name");
    await wrapper.get("#new-launcher-description").setValue("my description");
    await wrapper.get("#new-launcher-command").setValue("make dev");
    await button.trigger("click");
    await flushPromises();
    expect(vi.mocked(invoke).mock.calls.some((c) => c[0] === "coding_agent_ask")).toBe(false);
    const { state } = await import("../stores/session");
    expect(state.toast).toContain("both filled");
  });

  it("offers the models and the efforts that the tool of the coding agent lists, with the efforts of the chosen model", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const codexOutput = readFileSync(resolve(import.meta.dirname, "../lib/codex_debug_models.fixture.json"), "utf8");
    vi.mocked(invoke).mockImplementation(async (command: string) => (command === "coding_agent_models_run" ? codexOutput : null));
    const { wrapper } = await mountNewCustomLauncherModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("input[name=new-launcher-agent][value=codex]").setValue();
    await flushPromises();
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("coding_agent_models_run", { executable: "codex", arguments: ["debug", "models"] });
    const modelTexts = wrapper.findAll("#new-launcher-model option").map((option) => option.text());
    expect(modelTexts).toContain("GPT-6.1-Sol");
    expect(modelTexts).not.toContain("GPT-Reserve");
    await wrapper.get("#new-launcher-model").setValue("gpt-6.1-sol");
    expect(wrapper.findAll("#new-launcher-effort option").map((option) => option.text())).toContain("ultra");
    await wrapper.get("#new-launcher-model").setValue("gpt-6-luna");
    expect(wrapper.findAll("#new-launcher-effort option").map((option) => option.text())).not.toContain("ultra");
  });

  it("offers the models that agy models lists, and builds the command line of Antigravity", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const output = "Fetching available models...\nclaude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)\ngemini-3.8-flash-low\tGemini 3.8 Flash (Low)\n";
    vi.mocked(invoke).mockImplementation(async (command: string) => (command === "coding_agent_models_run" ? output : null));
    const { wrapper, project } = await mountNewCustomLauncherModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("input[name=new-launcher-agent][value=agy]").setValue();
    await flushPromises();
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("coding_agent_models_run", { executable: "agy", arguments: ["models"] });
    expect(wrapper.findAll("#new-launcher-model option").map((option) => option.text())).toContain("Gemini 3.8 Flash (Low)");
    await wrapper.get("#new-launcher-name").setValue("ask");
    await wrapper.get("#new-launcher-model").setValue("gemini-3.8-flash-low");
    await wrapper.get("#new-launcher-prompt").setValue("Hi");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers[1]).toMatchObject({
      command: "agy --model 'gemini-3.8-flash-low' -i 'Hi'",
      agent: { name: "agy", model: "gemini-3.8-flash-low", prompt: "Hi" },
    });
  });

  it("remembers the kind, the coding agent, the model, and the effort, and nothing else", async () => {
    const first = await mountNewCustomLauncherModal();
    await first.wrapper.get("input[value=codingAgent]").setValue();
    await first.wrapper.get("input[name=new-launcher-agent][value=codex]").setValue();
    await first.wrapper.get("#new-launcher-model").setValue("gpt-6-luna");
    await first.wrapper.get("#new-launcher-effort").setValue("low");
    await first.wrapper.get("#new-launcher-name").setValue("not remembered");
    await first.wrapper.get("#new-launcher-prompt").setValue("not remembered");
    const saved = JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}");
    expect(saved).toMatchObject({ customLauncherKind: "codingAgent", customLauncherAgent: "codex", customLauncherModel: "gpt-6-luna", customLauncherEffort: "low" });
    first.wrapper.unmount();
    document.body.innerHTML = "";
    vi.resetModules();
    const second = await mountNewCustomLauncherModal();
    expect((second.wrapper.get("input[value=codingAgent]").element as HTMLInputElement).checked).toBe(true);
    expect((second.wrapper.get("input[name=new-launcher-agent][value=codex]").element as HTMLInputElement).checked).toBe(true);
    expect((second.wrapper.get("#new-launcher-model").element as HTMLSelectElement).value).toBe("gpt-6-luna");
    expect((second.wrapper.get("#new-launcher-effort").element as HTMLSelectElement).value).toBe("low");
    expect((second.wrapper.get("#new-launcher-name").element as HTMLInputElement).value).toBe("");
    expect((second.wrapper.get("#new-launcher-prompt").element as HTMLTextAreaElement).value).toBe("");
  });

  it("edits an existing launcher: fills the fields, and saves the changes in the same launcher", async () => {
    const first = await mountNewCustomLauncherModal();
    first.wrapper.unmount();
    document.body.innerHTML = "";
    const { project } = await import("../stores/project");
    const { newCustomLauncherModal } = await import("../stores/newCustomLauncher");
    const { default: NewCustomLauncherModal } = await import("./NewCustomLauncherModal.vue");
    newCustomLauncherModal.editedId = "dev";
    newCustomLauncherModal.open = true;
    const wrapper = mount(NewCustomLauncherModal, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.get("h2").text()).toBe("Edit a custom launcher");
    expect((wrapper.get("#new-launcher-name").element as HTMLInputElement).value).toBe("start the server");
    expect((wrapper.get("#new-launcher-command").element as HTMLTextAreaElement).value).toBe("make dev");
    await wrapper.get("#new-launcher-name").setValue("start it");
    await wrapper.get("#new-launcher-command").setValue("make dev2");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const launchers = project.byWorkspace["w1"]!.config.launchers;
    expect(launchers).toHaveLength(1);
    expect(launchers[0]).toMatchObject({ id: "dev", label: "start it" });
    expect(newCustomLauncherModal.open).toBe(false);
  });

  it("puts the current work directory below the description and above the command line", async () => {
    const { wrapper } = await mountNewCustomLauncherModal();
    const description = wrapper.get("#new-launcher-description").element;
    const folder = wrapper.get("#new-launcher-folder").element;
    const command = wrapper.get("#new-launcher-command").element;
    expect(wrapper.get("label[for=new-launcher-folder]").text()).toBe("Current work directory");
    expect(description.compareDocumentPosition(folder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(folder.compareDocumentPosition(command) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("creates a launcher of the kind Command line that runs in the chosen folder", async () => {
    const { wrapper, project } = await mountNewCustomLauncherModal();
    await wrapper.get("#new-launcher-name").setValue("dev");
    await wrapper.get("#new-launcher-folder").setValue("packages/apps/desktop_tauri");
    await wrapper.get("#new-launcher-command").setValue("pnpm dev");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers[1]).toMatchObject({ command: "pnpm dev", cwd: "packages/apps/desktop_tauri" });
  });

  it("creates a launcher of the kind Command line without a work directory when the field is empty", async () => {
    const { wrapper, project } = await mountNewCustomLauncherModal();
    await wrapper.get("#new-launcher-name").setValue("test");
    await wrapper.get("#new-launcher-command").setValue("make test");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers[1].cwd).toBeUndefined();
  });

  it("does not allow Create for a launcher of the kind Command line whose folder is outside the repository", async () => {
    const { wrapper } = await mountNewCustomLauncherModal();
    await wrapper.get("#new-launcher-name").setValue("test");
    await wrapper.get("#new-launcher-command").setValue("make test");
    await wrapper.get("#new-launcher-folder").setValue("../other");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
    expect(wrapper.get("#new-launcher-folder").classes()).toContain("is-invalid");
  });

  it("fills the work directory of an imported launcher, and saves a change or a cleared field", async () => {
    const first = await mountNewCustomLauncherModal();
    first.wrapper.unmount();
    document.body.innerHTML = "";
    const { project } = await import("../stores/project");
    const { newCustomLauncherModal } = await import("../stores/newCustomLauncher");
    const { default: NewCustomLauncherModal } = await import("./NewCustomLauncherModal.vue");
    project.byWorkspace["w1"]!.config.launchers[0].cwd = "packages/web";
    newCustomLauncherModal.editedId = "dev";
    newCustomLauncherModal.open = true;
    const wrapper = mount(NewCustomLauncherModal, { attachTo: document.body });
    await flushPromises();
    expect((wrapper.get("#new-launcher-folder").element as HTMLInputElement).value).toBe("packages/web");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers[0].cwd).toBe("packages/web");

    newCustomLauncherModal.editedId = "dev";
    newCustomLauncherModal.open = true;
    const second = mount(NewCustomLauncherModal, { attachTo: document.body });
    await flushPromises();
    await second.get("#new-launcher-folder").setValue("");
    await second.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.launchers[0].cwd).toBeUndefined();
  });

  it("closes without creating a launcher when the person clicks Cancel", async () => {
    const { wrapper, project, newCustomLauncherModal } = await mountNewCustomLauncherModal();
    await wrapper.get("#new-launcher-command").setValue("make test");
    await wrapper.get("button[title^=Cancel]").trigger("click");
    expect(newCustomLauncherModal.open).toBe(false);
    expect(project.byWorkspace["w1"]!.config.launchers).toHaveLength(1);
  });

  it("closes without creating a launcher when the person presses Escape", async () => {
    const { wrapper, project, newCustomLauncherModal } = await mountNewCustomLauncherModal();
    await wrapper.get("#new-launcher-command").setValue("make test");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushPromises();
    expect(newCustomLauncherModal.open).toBe(false);
    expect(project.byWorkspace["w1"]!.config.launchers).toHaveLength(1);
  });
});
