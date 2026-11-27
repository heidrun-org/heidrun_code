import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import paneCardSource from "./PaneCard.vue?raw";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
// The terminal needs a real browser (xterm, the colour scheme query): the pane header is the subject of these tests.
vi.mock("./TerminalView.vue", () => ({ default: { template: "<div></div>" } }));
// The file view reads a file through the backend: the tests of the file view are in FileView.test.ts.
vi.mock("./FileView.vue", () => ({ default: { props: ["pane", "controlsHost"], template: '<div class="file-view-stub"></div>' } }));
vi.mock("../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return {
    ...original,
    closePane: vi.fn(async () => ({})),
  };
});

const LONG_NAME = "jetienne@Jeromes-Macbook-Pro:~/webwork/heidrun";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

/** The declarations of the style rule of `selector`, in the style block of the component PaneCard. */
function styleRule(selector: string): string {
  const style = paneCardSource.slice(paneCardSource.indexOf("<style"));
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(style);
  expect(match, `the style rule ${selector}`).not.toBeNull();
  return match![1];
}

async function mountPaneCard(
  paneFields: Record<string, unknown> = {},
  isInColumnOfPinnedPanes = false,
  extraProps: Record<string, unknown> = {},
) {
  const { default: PaneCard } = await import("./PaneCard.vue");
  return mount(PaneCard, {
    props: {
      isInColumnOfPinnedPanes,
      ...extraProps,
      pane: {
        pane_id: 'w1:p1',
        terminal_id: "t1",
        workspace_id: "w1",
        tab_id: "w1:t1",
        focused: false,
        agent_status: "unknown",
        revision: 1,
        label: LONG_NAME,
        ...paneFields,
      },
    },
    global: { stubs: { MacroMenu: true } },
  });
}

describe("PaneCard", () => {
	it.each([false, true])('clears the window buttons at any zoom in Zen Mode (pinned: %s)', async (isPinned) => {
		const { FONT_DEFAULT, FONT_MIN, settings, zoomFactor } = await import('../stores/settings');
		const wrapper = await mountPaneCard({}, isPinned);
		const header = wrapper.get<HTMLElement>('header.head').element;

		settings.fontSize = FONT_DEFAULT;
		expect(header.style.paddingLeft).toBe('');

		await wrapper.get('button[aria-label="Enter Zen Mode"]').trigger('click');
		expect(header.style.paddingLeft).toBe('84px');

		settings.fontSize = FONT_MIN;
		await nextTick();
		expect(Number.parseFloat(header.style.paddingLeft) * zoomFactor()).toBeCloseTo(84);

		await wrapper.get('button[aria-label="Leave Zen Mode"]').trigger('click');
		expect(header.style.paddingLeft).toBe('');
	});

  it("lets the name get narrower than its text and ends it with an ellipsis, so it never runs under the buttons", () => {
    const rule = styleRule(".name");
    expect(rule).toContain("min-width: 0");
    expect(rule).toContain("overflow: hidden");
    expect(rule).toContain("text-overflow: ellipsis");
    expect(rule).toContain("white-space: nowrap");
  });

  it("does not let the buttons get narrower", () => {
    expect(styleRule(".tools")).toContain("flex-shrink: 0");
  });

	it('hides header buttons outside the pane while keeping their space in the header', () => {
		const rule = styleRule('.tools');
		expect(rule).toContain('opacity: 0;');
		expect(rule).toContain('visibility: hidden;');
		expect(rule).toContain('pointer-events: none;');
		expect(rule).toContain('display: flex;');
		expect(rule).not.toMatch(/display:\s*none/);
	});

	it('reveals header buttons over the entire pane without depending on pane focus', () => {
		const rule = styleRule('.pane:hover .tools');
		expect(rule).toContain('opacity: 1;');
		expect(rule).toContain('visibility: visible;');
		expect(rule).toContain('pointer-events: auto;');
		expect(paneCardSource).not.toMatch(/[^{}]*\.selected[^{}]*\.tools\s*\{/);
		expect(paneCardSource).not.toMatch(/[^{}]*:focus[^{}]*\.tools\s*\{/);
	});

	it('fades buttons in and out before hiding them from keyboard navigation', () => {
		expect(styleRule('.tools')).toContain(
			'transition: opacity 0.15s ease, visibility 0s linear 0.15s;',
		);
		expect(styleRule('.pane:hover .tools')).toContain('transition-delay: 0s;');
	});

  it("shows the whole name in the tooltip of the name, with the way to rename it", async () => {
    const wrapper = await mountPaneCard();
    expect(wrapper.get(".name").text()).toBe(LONG_NAME);
    expect(wrapper.get(".name").attributes("title")).toBe(`${LONG_NAME} · Double-click to rename`);
  });

  it("names a shell pane without a label after its folder, and shows the full folder path once, without the pane identifier", async () => {
    const wrapper = await mountPaneCard({
      label: null,
      terminal_title_stripped: LONG_NAME,
      cwd: "/Users/jetienne/webwork/heidrun",
    });
    expect(wrapper.get(".name").text()).toBe("heidrun");
    expect(wrapper.get(".sub").text()).toBe("~/webwork/heidrun");
  });

  it("shows the Git branch of the folder before the folder path in the header of a shell pane", async () => {
    const { git } = await import("../stores/git");
    git.branchByFolder["/Users/jetienne/webwork/heidrun"] = "dev_jerome";
    const wrapper = await mountPaneCard({
      label: null,
      terminal_title_stripped: LONG_NAME,
      cwd: "/Users/jetienne/webwork/heidrun",
    });
    expect(wrapper.get(".sub").text()).toBe("dev_jerome · ~/webwork/heidrun");
  });

  it("keeps the terminal title as the name of a shell pane while a command runs", async () => {
    const wrapper = await mountPaneCard({
      label: null,
      terminal_title_stripped: "npm run dev",
      cwd: "/Users/jetienne/webwork/heidrun",
    });
    expect(wrapper.get(".name").text()).toBe("npm run dev");
  });

  it("shows the pressed pin button in the header of a pane of the column of pinned panes, and no close button", async () => {
    const wrapper = await mountPaneCard({}, true);
    const unpinButton = wrapper.get("button[aria-label='Unpin the pane']");
    expect(unpinButton.attributes("aria-pressed")).toBe("true");
    expect(unpinButton.classes()).toContain("on");
    expect(unpinButton.find(".bi-pin-fill").exists()).toBe(true);
    expect(wrapper.find(".bi-x-lg").exists()).toBe(false);
    expect(wrapper.find("button[title='Go to its tab']").exists()).toBe(true);
  });

  it("unpins the pane of the column of pinned panes when the pressed pin button is clicked", async () => {
    const { settings } = await import("../stores/settings");
    settings.pinnedPanes = ['w1:p1'];
    const wrapper = await mountPaneCard({}, true);
    await wrapper.get("button[aria-label='Unpin the pane']").trigger("click");
    expect(settings.pinnedPanes).toEqual([]);
  });

  it("is the selected pane in the column of pinned panes when it is the selected pane of the selected tab", async () => {
    const { state } = await import("../stores/session");
    const { pinnedPaneState } = await import("../stores/pinned_panes");
    state.selectedPaneId = 'w1:p1';
    pinnedPaneState.focus = null;
    const wrapper = await mountPaneCard({}, true);
    expect(wrapper.get("section").classes()).toContain("selected");
  });

  it("is not the selected pane in the column of pinned panes when another pinned pane has the keyboard", async () => {
    const { state } = await import("../stores/session");
    const { pinnedPaneState } = await import("../stores/pinned_panes");
    state.selectedPaneId = 'w1:p1';
    // The store gives the keyboard back to the grid when the selected pane changes: wait for that, then pin the focus.
    await nextTick();
    pinnedPaneState.focus = "w1:p2";
    const wrapper = await mountPaneCard({}, true);
    expect(wrapper.get("section").classes()).not.toContain("selected");
  });

  it("gives the header of the selected pane a tinted background, in the grid and in the column of pinned panes", () => {
    expect(styleRule(".pane.several-panes.selected:not(.blocked) .head")).toContain("background: var(--pane-head-selected)");
    expect(styleRule(".pane.in-column-of-pinned-panes.several-panes.selected:not(.blocked) .head")).toContain(
      "background: var(--pane-head-selected)",
    );
  });

  it("dims the name and the folder in the header of a pane that is not selected and not blocked", () => {
    expect(styleRule(".pane.several-panes:not(.selected):not(.blocked) .name")).toContain("color: var(--muted)");
    expect(styleRule(".pane.several-panes:not(.selected):not(.blocked) .sub")).toContain("color: var(--muted)");
  });

  it("never tints the header of a blocked pane, so that it keeps its red header", () => {
    expect(paneCardSource).not.toMatch(/\.pane\.several-panes\.selected \.head \{/);
    expect(styleRule(".pane.blocked .head")).toContain("background: var(--tint-err)");
  });

  it("has no highlight when the viewport shows one pane", async () => {
    const { state } = await import("../stores/session");
    state.snapshot = { panes: [{ pane_id: 'w1:p1', tab_id: "w1:t1", workspace_id: "w1" }] } as never;
    state.selectedTabId = "w1:t1";
    const wrapper = await mountPaneCard();
    expect(wrapper.get("section").classes()).not.toContain("several-panes");
  });

  it("has the highlight when the selected tab has two panes", async () => {
    const { state } = await import("../stores/session");
    state.snapshot = {
      panes: [
        { pane_id: 'w1:p1', tab_id: "w1:t1", workspace_id: "w1" },
        { pane_id: "w1:p2", tab_id: "w1:t1", workspace_id: "w1" },
      ],
    } as never;
    state.selectedTabId = "w1:t1";
    const wrapper = await mountPaneCard();
    expect(wrapper.get("section").classes()).toContain("several-panes");
  });

  it("has the highlight when the selected tab has one pane and a pinned pane of another tab is in the column", async () => {
    const { state } = await import("../stores/session");
    const { settings } = await import("../stores/settings");
    state.snapshot = {
      panes: [
        { pane_id: 'w1:p1', tab_id: "w1:t1", workspace_id: "w1" },
        { pane_id: "w1:p9", tab_id: "w1:t2", workspace_id: "w1" },
      ],
    } as never;
    state.selectedTabId = "w1:t1";
    settings.pinnedPanes = ["w1:p9"];
    const wrapper = await mountPaneCard();
    expect(wrapper.get("section").classes()).toContain("several-panes");
  });
});

describe("PaneCard composition bar", () => {
  async function selectPaneWithBar(selectedPaneId: string, isOpen: boolean) {
    const { state } = await import("../stores/session");
    const { CompositionBar } = await import("../stores/composition_bar");
    const compositionBar = CompositionBar.forPane('w1:p1');
    state.selectedPaneId = selectedPaneId;
    compositionBar.isOpen = isOpen;
    compositionBar.paths = isOpen ? ["/shots/a.png"] : [];
  }

  it("shows the composition bar under the terminal of the selected pane when it is open", async () => {
    await selectPaneWithBar('w1:p1', true);
    const wrapper = await mountPaneCard();
    const children = [...wrapper.get("section").element.children];
    expect(wrapper.find(".composition-bar").exists()).toBe(true);
    expect(children[children.length - 1].classList.contains("composition-bar")).toBe(true);
  });

  it("shows no composition bar when it is closed", async () => {
    await selectPaneWithBar('w1:p1', false);
    const wrapper = await mountPaneCard();
    expect(wrapper.find(".composition-bar").exists()).toBe(false);
  });

  it("keeps its composition bar open when another pane is selected", async () => {
    await selectPaneWithBar('w1:other', true);
    const wrapper = await mountPaneCard();
    expect(wrapper.find(".composition-bar").exists()).toBe(true);
  });
});

describe("PaneCard composition bar toggle button", () => {
  async function selectPane(selectedPaneId: string, isOpen: boolean, isVoiceInputOn = false) {
    const { state } = await import("../stores/session");
    const { settings } = await import("../stores/settings");
    const { CompositionBar } = await import("../stores/composition_bar");
    const compositionBar = CompositionBar.forPane('w1:p1');
    state.selectedPaneId = selectedPaneId;
    settings.voiceInput = isVoiceInputOn;
    compositionBar.isOpen = isOpen;
    compositionBar.paths = [];
    compositionBar.text = "";
  }

  it("shows the toggle button in the header of the selected pane, with the icon of a text input", async () => {
    await selectPane('w1:p1', false);
    const wrapper = await mountPaneCard();
    const button = wrapper.find(".head .tools button[aria-label='Composition bar']");
    expect(button.exists()).toBe(true);
    expect(button.find(".bi-input-cursor-text").exists()).toBe(true);
  });

  it("shows the toggle button in a pane that is not the selected pane", async () => {
    await selectPane('w1:other', false);
    const wrapper = await mountPaneCard();
    expect(wrapper.find("button[aria-label='Composition bar']").exists()).toBe(true);
  });

  it("is pressed and highlighted while the composition bar is open, and not pressed while it is closed", async () => {
    await selectPane('w1:p1', false);
    const wrapper = await mountPaneCard();
    const button = wrapper.get("button[aria-label='Composition bar']");
    expect(button.attributes("aria-pressed")).toBe("false");
    expect(button.classes()).not.toContain("on");
    const { CompositionBar } = await import("../stores/composition_bar");
    const compositionBar = CompositionBar.forPane('w1:p1');
    compositionBar.isOpen = true;
    await nextTick();
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(button.classes()).toContain("on");
  });

  it("opens the composition bar with one click, and closes it with the next click", async () => {
    await selectPane('w1:p1', false);
    const { CompositionBar } = await import("../stores/composition_bar");
    const compositionBar = CompositionBar.forPane('w1:p1');
    const wrapper = await mountPaneCard();
    expect(wrapper.find(".composition-bar").exists()).toBe(false);
    await wrapper.get("button[aria-label='Composition bar']").trigger("click");
    expect(compositionBar.isOpen).toBe(true);
    expect(wrapper.find(".composition-bar").exists()).toBe(true);
    await wrapper.get("button[aria-label='Composition bar']").trigger("click");
    expect(compositionBar.isOpen).toBe(false);
    expect(wrapper.find(".composition-bar").exists()).toBe(false);
  });

  it("is there whether the voice input is on or off, and the header has no push-to-talk button", async () => {
    for (const isVoiceInputOn of [false, true]) {
      await selectPane('w1:p1', false, isVoiceInputOn);
      const wrapper = await mountPaneCard();
      expect(wrapper.find("button[aria-label='Composition bar']").exists()).toBe(true);
      expect(wrapper.find("button[aria-label='Push to talk']").exists()).toBe(false);
      wrapper.unmount();
    }
  });

  it("shows the push-to-talk button in the composition bar when the voice input is on", async () => {
    await selectPane('w1:p1', true, true);
    const wrapper = await mountPaneCard();
    expect(wrapper.find(".composition-bar button[aria-label='Push to talk']").exists()).toBe(true);
    expect(wrapper.find(".head button[aria-label='Push to talk']").exists()).toBe(false);
  });
});

describe("PaneCard usage wheel", () => {
  const WITH_CONTEXT = { agent: "claude", tokens: { hd_ctx: 7, hd_ctx_size: 200_000 } };

  it("shows the context window as a usage wheel, with no word, no bar, and no number beside it", async () => {
    const wrapper = await mountPaneCard(WITH_CONTEXT);
    expect(wrapper.find(".head .usage-wheel").exists()).toBe(true);
    expect(wrapper.find(".head .gauge").exists()).toBe(false);
    expect(wrapper.get(".head").text()).not.toContain("context");
    expect(wrapper.get(".head").text()).not.toContain("%");
  });

  it("puts the usage wheel first in the group of the header buttons, so it follows the same hover rule and fade", async () => {
    const wrapper = await mountPaneCard(WITH_CONTEXT);
    expect(wrapper.find(".head > .usage-wheel").exists()).toBe(false);
    expect(wrapper.find(".head > .information-card-part").exists()).toBe(false);
    const firstItem = wrapper.get(".head .tools").element.firstElementChild;
    expect(firstItem?.classList.contains("information-card-part")).toBe(true);
    expect(firstItem?.querySelector(".usage-wheel")).not.toBeNull();
    expect(wrapper.findAll(".head .tools > button").length).toBeGreaterThan(0);
  });

  it("keeps the gap before the first header button at the gap between two buttons, with no extra margin", () => {
    const rule = styleRule(".tools");
    expect(rule).toContain("gap: 2px");
    expect(rule).not.toContain("margin-left");
  });

  it("shows no usage wheel when the program does not know the context window", async () => {
    const wrapper = await mountPaneCard();
    expect(wrapper.find(".usage-wheel").exists()).toBe(false);
  });

  it("opens the information card of the usage wheel on a click, with the tokens and the size", async () => {
    const wrapper = await mountPaneCard(WITH_CONTEXT);
    expect(wrapper.find(".popover").exists()).toBe(false);
    await wrapper.get(".information-card-part").trigger("click");
    expect(wrapper.get("[data-field=percent]").text()).toContain("7 %");
    expect(wrapper.get("[data-field=used]").text()).toContain("14,000 tokens");
    expect(wrapper.get("[data-field=size]").text()).toContain("200,000 tokens");
  });

  it("puts the pane that holds the open card above the next panes, so that no pane hides the card", () => {
    expect(styleRule(".pane:has(.information-card-part.is-open)")).toContain("z-index: 8");
  });

  it("puts the pane that holds the open card above the lines between the panes, the line of the right sidebar, and the corners (issue #586)", () => {
    const level = Number(/z-index: (\d+)/.exec(styleRule(".pane:has(.information-card-part.is-open)"))?.[1]);
    // The highest of them is the corner of the viewport, at the level 7 (PaneGrid.vue).
    expect(level).toBeGreaterThan(7);
  });
});

describe("PaneCard close", () => {
  // The store of the settings saves itself in the local storage, so the value of the previous test comes back: reset it.
  // The mocked function `closePane` keeps the calls of the previous test: clear them.
  beforeEach(async () => {
    vi.clearAllMocks();
    const { settings } = await import("../stores/settings");
    settings.confirmPaneClose = true;
  });

  it("closes the pane at once, without the confirmation dialog, when the setting confirmPaneClose is off", async () => {
    const { settings } = await import("../stores/settings");
    settings.confirmPaneClose = false;
    const wrapper = await mountPaneCard();
    const { confirmDialog } = await import("../stores/confirm");
    const api = await import("../lib/api");
    await wrapper.get("button[aria-label='Close the pane (⌘W)']").trigger("click");
    await flushPromises();
    expect(confirmDialog.open).toBe(false);
    expect(api.closePane).toHaveBeenCalledWith('w1:p1');
  });

  it("asks for confirmation before it closes the pane, and does not close before the answer", async () => {
    const wrapper = await mountPaneCard();
    const { confirmDialog } = await import("../stores/confirm");
    const api = await import("../lib/api");
    await wrapper.get("button[aria-label='Close the pane (⌘W)']").trigger("click");
    expect(confirmDialog.open).toBe(true);
    expect(confirmDialog.title).toBe("Close the pane (⌘W)");
    expect(api.closePane).not.toHaveBeenCalled();
  });

  it("closes the pane after the user confirms, and does not close it when the user cancels", async () => {
    const wrapper = await mountPaneCard();
    const { answerConfirm } = await import("../stores/confirm");
    const api = await import("../lib/api");
    await wrapper.get("button[aria-label='Close the pane (⌘W)']").trigger("click");
    answerConfirm(false);
    await flushPromises();
    expect(api.closePane).not.toHaveBeenCalled();
    await wrapper.get("button[aria-label='Close the pane (⌘W)']").trigger("click");
    answerConfirm(true);
    await flushPromises();
    expect(api.closePane).toHaveBeenCalledWith('w1:p1');
  });
});

describe("PaneCard file view pane (issue #714)", () => {
  const FILE_LABEL = "Heidrun file view: /Users/someone/project/docs/README.md";

  it("shows the file view in place of the terminal, and names the pane after the file", async () => {
    const wrapper = await mountPaneCard({ label: FILE_LABEL });
    expect(wrapper.find(".file-view-stub").exists()).toBe(true);
    expect(wrapper.find(".name").text()).toBe("README.md");
  });

  it("shows the short path of the file in the header, and the absolute path in the title of the name", async () => {
    const wrapper = await mountPaneCard({ label: FILE_LABEL });
    expect(wrapper.find(".sub").text()).toBe("~/project/docs/README.md");
    expect(wrapper.find(".name").attributes("title")).toBe("/Users/someone/project/docs/README.md");
  });

  it("does not start a rename when the name is double-clicked, because the label holds the file", async () => {
    const wrapper = await mountPaneCard({ label: FILE_LABEL });
    await wrapper.find(".name").trigger("dblclick");
    const { state } = await import("../stores/session");
    expect(state.renaming).toBeNull();
  });

  it("has no button for the composition bar, and keeps the close button", async () => {
    const wrapper = await mountPaneCard({ label: FILE_LABEL });
    expect(wrapper.find('[aria-pressed][aria-label="Composition bar"]').exists()).toBe(false);
    expect(wrapper.find(".tools").exists()).toBe(true);
    expect(wrapper.html()).toContain("Close the pane");
  });

  it("gives the file view an element of the header to put its controls in, after the short path", async () => {
    const wrapper = await mountPaneCard({ label: FILE_LABEL });
    await flushPromises();
    const host = wrapper.get("header .file-view-controls").element;
    expect(wrapper.getComponent({ name: "FileView" }).props("controlsHost")).toBe(host);
    expect(wrapper.get("header .sub").element.nextElementSibling).toBe(host);
  });

  it("has no element for the controls of a file in the header of a terminal", async () => {
    const wrapper = await mountPaneCard({ label: "build" });
    expect(wrapper.find(".file-view-controls").exists()).toBe(false);
  });

  it("shortens the short path before the name when the header is narrow, and never shrinks the controls", async () => {
    expect(styleRule(".sub.file-view-path")).toContain("flex-shrink: 10000");
    expect(styleRule(".sub.file-view-path")).toContain("min-width: 0");
    expect(styleRule(".file-view-controls")).toContain("flex-shrink: 0");
  });

  it("shows the terminal, and not the file view, for a pane whose label is only a name", async () => {
    const wrapper = await mountPaneCard({ label: "build" });
    expect(wrapper.find(".file-view-stub").exists()).toBe(false);
    expect(wrapper.find(".name").text()).toBe("build");
  });
});

describe("PaneCard: moving the pane", () => {
  it("starts a move of the pane when the header is pressed", async () => {
    const wrapper = await mountPaneCard();
    const { PaneMoveDrag } = await import("../stores/pane_move");
    const start = vi.spyOn(PaneMoveDrag, "onPointerDown").mockImplementation(() => {});
    await wrapper.get("header.head").trigger("pointerdown");
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][1]).toBe("w1:p1");
  });

  it("starts a move from a press on a button of the header too, and lets the move code refuse it", async () => {
    const wrapper = await mountPaneCard();
    const { PaneMoveDrag } = await import("../stores/pane_move");
    const start = vi.spyOn(PaneMoveDrag, "onPointerDown").mockImplementation(() => {});
    await wrapper.get("header.head button").trigger("pointerdown");
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("starts no move from a pinned pane of the column of pinned panes", async () => {
    const wrapper = await mountPaneCard({}, true);
    const { PaneMoveDrag } = await import("../stores/pane_move");
    const start = vi.spyOn(PaneMoveDrag, "onPointerDown").mockImplementation(() => {});
    await wrapper.get("header.head").trigger("pointerdown");
    expect(start).not.toHaveBeenCalled();
  });

  it("marks a pane of the grid as a destination for a drop, with its identifier", async () => {
    const wrapper = await mountPaneCard();
    expect(wrapper.get("section.pane").attributes("data-pane-move-destination")).toBe("w1:p1");
  });

  it("does not mark a pinned pane of the column of pinned panes as a destination", async () => {
    const wrapper = await mountPaneCard({}, true);
    expect(wrapper.get("section.pane").attributes("data-pane-move-destination")).toBeUndefined();
  });

  it("marks the destination with the attribute that the move code looks for", async () => {
    const { PANE_MOVE_DESTINATION_ATTRIBUTE } = await import("../stores/pane_move");
    expect(paneCardSource).toContain(PANE_MOVE_DESTINATION_ATTRIBUTE);
  });
});
