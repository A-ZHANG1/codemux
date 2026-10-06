import { describe, expect, it } from "vitest";
import { getAgentActivities } from "../../../../src/lib/agent-activity";
import type { ToolPart, UnifiedMessage } from "../../../../src/types/unified";

const task = (state: ToolPart["state"], callId = "explore"): ToolPart => ({
  id: `part-${callId}`,
  messageId: "assistant",
  sessionId: "session",
  type: "tool",
  callId,
  normalizedTool: "task",
  originalTool: "irrelevant-engine-name",
  title: "Explore",
  kind: "other",
  state,
});
const running = task({ status: "running", input: {}, time: { start: 1 } });
const completed = task({
  status: "completed", input: {}, output: "Found files", time: { start: 1, end: 2, duration: 1 },
});
const message: UnifiedMessage = {
  id: "assistant", sessionId: "session", role: "assistant", time: { created: 1 }, parts: [running],
};
const defaults = {
  sessionId: "session", messages: [message], parts: {}, sending: true, waiting: false, connected: true,
};

describe("getAgentActivities", () => {
  it("shows only an idle lead when no tasks exist", () => {
    const agents = getAgentActivities({ ...defaults, messages: [], sending: false });
    expect(agents).toHaveLength(1);
    expect(agents[0].status).toBe("idle");
  });

  it("tracks a delegated task by a stable identity from departure through return", () => {
    const before = getAgentActivities(defaults);
    const after = getAgentActivities({ ...defaults, parts: { assistant: [completed] } });
    expect(before[1]).toMatchObject({ title: "Explore", status: "working" });
    expect(after[1]).toMatchObject({ id: before[1].id, status: "completed" });
  });

  it("uses live parts rather than stale message snapshots", () => {
    expect(getAgentActivities({ ...defaults, parts: { assistant: [] } })).toHaveLength(1);
  });

  it("deduplicates start and completion parts with the same call ID", () => {
    const agents = getAgentActivities({ ...defaults, parts: { assistant: [running, completed] } });
    expect(agents).toHaveLength(2);
    expect(agents[1].status).toBe("completed");
  });

  it("keeps parallel agents and ignores ordinary tools", () => {
    const second = task(running.state, "review");
    const agents = getAgentActivities({
      ...defaults, parts: { assistant: [running, second, { ...running, normalizedTool: "read", callId: "read" }] },
    });
    expect(agents).toHaveLength(3);
    expect(agents[1].id).not.toBe(agents[2].id);
  });

  it.each([
    [{ waiting: true }, "waiting"],
    [{ connected: false }, "offline"],
    [{ sending: false }, "stopped"],
  ] as const)("does not pretend an unfinished task succeeded (%j)", (state, expected) => {
    expect(getAgentActivities({ ...defaults, ...state })[1].status).toBe(expected);
  });

  it("shows pending tasks as waiting, not working", () => {
    const agents = getAgentActivities({
      ...defaults, parts: { assistant: [task({ status: "pending" })] },
    });
    expect(agents[1].status).toBe("waiting");
  });

  it("preserves explicit task failures even when the connection is lost", () => {
    const failed = task({
      status: "error", input: {}, error: "Command failed", time: { start: 1, end: 2, duration: 1 },
    });
    const agents = getAgentActivities({ ...defaults, connected: false, parts: { assistant: [failed] } });
    expect(agents[0].status).toBe("offline");
    expect(agents[1]).toMatchObject({ status: "error", error: "Command failed" });
  });

  it.each([["Cancelled", "stopped"], ["Engine failed", "error"]] as const)(
    "surfaces the lead's %s outcome",
    (error, expected) => {
      const agents = getAgentActivities({ ...defaults, sending: false, messages: [{ ...message, error }] });
      expect(agents[0].status).toBe(expected);
      expect(agents[1].status).toBe("stopped");
    },
  );

  it("returns the lead only after an explicit completion", () => {
    const agents = getAgentActivities({
      ...defaults, sending: false, messages: [{ ...message, time: { created: 1, completed: 2 }, parts: [completed] }],
    });
    expect(agents.map((agent) => agent.status)).toEqual(["completed", "completed"]);
  });

  it("excludes previous turns and other sessions", () => {
    const user: UnifiedMessage = { ...message, id: "user", role: "user", parts: [] };
    const foreign: UnifiedMessage = { ...message, id: "foreign", sessionId: "other" };
    const agents = getAgentActivities({ ...defaults, messages: [message, user, foreign] });
    expect(agents).toHaveLength(1);
  });

  it("includes tasks from multiple assistant messages in the same turn", () => {
    const next: UnifiedMessage = { ...message, id: "next", parts: [task(running.state, "review")] };
    expect(getAgentActivities({ ...defaults, messages: [message, next] })).toHaveLength(3);
  });
});
