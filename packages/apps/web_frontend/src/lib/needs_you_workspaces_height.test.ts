// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NeedsYouWorkspacesHeight } from "./needs_you_workspaces_height";

describe("NeedsYouWorkspacesHeight (issue #807)", () => {
  it("keeps a height that fits", () => {
    expect(NeedsYouWorkspacesHeight.clamp(300, 900)).toBe(300);
  });

  it("never goes under the title and one row", () => {
    expect(NeedsYouWorkspacesHeight.clamp(10, 900)).toBe(NeedsYouWorkspacesHeight.MIN);
  });

  it("leaves 80 pixels to the cards of the agents", () => {
    expect(NeedsYouWorkspacesHeight.clamp(2000, 900)).toBe(900 - 80);
  });

  it("keeps the title and one row when the sidebar section is too small for both", () => {
    expect(NeedsYouWorkspacesHeight.clamp(300, 120)).toBe(NeedsYouWorkspacesHeight.MIN);
  });

  it("gives a whole number of pixels", () => {
    expect(NeedsYouWorkspacesHeight.clamp(200.6, 900)).toBe(201);
  });
});
