// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildStatusItemPayload, type StatusItemInput } from "./status_item";

const input: StatusItemInput = {
  agents: [
    { paneId: "p1", name: "api · fix", status: "blocked", since: 1_000_000 },
    { paneId: "p2", name: "web · test", status: "done", since: 1_000_000 },
    { paneId: "p3", name: "web · build", status: "working", since: 1_000_000 },
    { paneId: "p4", name: "web · lint", status: "working", since: 1_000_000 },
    { paneId: "p5", name: "docs · notes", status: "idle", since: null },
  ],
  now: 1_000_000 + 2 * 60_000,
  blockedLimitMs: 5 * 60_000,
  titles: { blocked: "Blocked", done: "Finished", working: "Working" },
  openLabel: "Open Heidrun Code",
  emptyLabel: "No agent",
};

describe("buildStatusItemPayload", () => {
  it("puts each agent in the section of its status and leaves out the idle agents", () => {
    const payload = buildStatusItemPayload(input);
    expect(payload.blocked.agents).toEqual([{ paneId: "p1", name: "api · fix" }]);
    expect(payload.done.agents).toEqual([{ paneId: "p2", name: "web · test" }]);
    expect(payload.working.agents.map((agent) => agent.paneId)).toEqual(["p3", "p4"]);
  });

  it("gives each section its title without the number of agents", () => {
    const payload = buildStatusItemPayload(input);
    expect(payload.blocked.title).toBe("Blocked");
    expect(payload.done.title).toBe("Finished");
    expect(payload.working.title).toBe("Working");
  });

  it("keeps the title of a section without agent and gives it no agent", () => {
    const payload = buildStatusItemPayload({ ...input, agents: [] });
    expect(payload.done.title).toBe("Finished");
    expect(payload.done.agents).toEqual([]);
  });

  it("is not urgent while the blocked agent waits for less than the limit", () => {
    expect(buildStatusItemPayload(input).isUrgent).toBe(false);
  });

  it("is urgent when an agent has been blocked for the limit or longer", () => {
    const later = { ...input, now: 1_000_000 + 5 * 60_000 };
    expect(buildStatusItemPayload(later).isUrgent).toBe(true);
  });

  it("is never urgent when the limit is 0", () => {
    const off = { ...input, now: 1_000_000 + 60 * 60_000, blockedLimitMs: 0 };
    expect(buildStatusItemPayload(off).isUrgent).toBe(false);
  });

  it("is not urgent for a finished or working agent that waits for a long time", () => {
    const agents = input.agents.filter((agent) => agent.status !== "blocked");
    const later = { ...input, agents, now: 1_000_000 + 60 * 60_000 };
    expect(buildStatusItemPayload(later).isUrgent).toBe(false);
  });

  it("is not urgent when the time of a blocked agent is not known", () => {
    const agents = input.agents.map((agent) => ({ ...agent, since: null }));
    const later = { ...input, agents, now: 1_000_000 + 60 * 60_000 };
    expect(buildStatusItemPayload(later).isUrgent).toBe(false);
  });
});
