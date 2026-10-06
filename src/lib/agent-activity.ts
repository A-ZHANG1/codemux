import type { ToolPart, UnifiedMessage, UnifiedPart } from "../types/unified";

export type AgentActivityStatus =
  | "idle"
  | "working"
  | "waiting"
  | "completed"
  | "error"
  | "stopped"
  | "offline";

export interface AgentActivity {
  id: string;
  title: string;
  status: AgentActivityStatus;
  error?: string;
}

interface AgentActivityInput {
  sessionId: string;
  messages: readonly UnifiedMessage[];
  parts: Readonly<Record<string, readonly UnifiedPart[]>>;
  sending: boolean;
  waiting: boolean;
  connected: boolean;
}

export function getAgentActivities(input: AgentActivityInput): AgentActivity[] {
  // Only the current turn belongs in the room; old tasks must not stay "running".
  const turn: UnifiedMessage[] = [];
  for (let i = input.messages.length - 1; i >= 0; i--) {
    const message = input.messages[i];
    if (message.sessionId !== input.sessionId) continue;
    if (message.role === "user") break;
    turn.unshift(message);
  }

  const latest = turn.at(-1);
  const failure = turn.findLast((message) => message.error)?.error;
  const activeStatus = !input.connected ? "offline" : input.waiting ? "waiting" : "working";
  const leadStatus: AgentActivityStatus = !input.connected
    ? "offline"
    : input.waiting
      ? "waiting"
      : input.sending
        ? "working"
        : failure
          ? failure === "Cancelled" ? "stopped" : "error"
          : latest?.time.completed !== undefined ? "completed" : "idle";
  const agents: AgentActivity[] = [{
    id: `${input.sessionId}:lead`,
    title: "",
    status: leadStatus,
    error: failure,
  }];

  const tasks = new Map<string, ToolPart>();
  for (const message of turn) {
    for (const part of input.parts[message.id] ?? message.parts) {
      if (part.sessionId === input.sessionId && part.type === "tool" && part.normalizedTool === "task") {
        tasks.set(part.callId || part.id, part);
      }
    }
  }

  for (const [id, task] of tasks) {
    const status: AgentActivityStatus = task.state.status === "completed"
      ? "completed"
      : task.state.status === "error"
        ? "error"
        : !input.connected
          ? "offline"
          : !input.sending && !input.waiting
            ? "stopped"
            : task.state.status === "pending" ? "waiting" : activeStatus;
    agents.push({
      id: `${input.sessionId}:task:${id}`,
      title: task.title,
      status,
      error: task.state.status === "error" ? task.state.error : undefined,
    });
  }
  return agents;
}
