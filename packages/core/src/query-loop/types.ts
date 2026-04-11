import type { ToolResult } from "../tool-registry/types.js";
import type { ToolRegistry } from "../tool-registry/registry.js";
import type { PermissionEngine } from "../permission-engine/engine.js";

export interface Message {
  role: "user" | "assistant" | "tool_result" | "system";
  content: string;
  toolCall?: { name: string; input: unknown };
  toolResult?: ToolResult;
}

export interface Decision {
  type: "tool_call" | "response" | "done";
  toolCall?: { name: string; input: unknown };
  response?: string;
}

export type DecisionFn = (messages: readonly Message[]) => Promise<Decision>;

export interface LoopConfig {
  registry: ToolRegistry;
  permissionEngine: PermissionEngine;
  decide: DecisionFn;
  maxIterations?: number;
  onMessage?: (msg: Message) => void;
}

export interface LoopResult {
  messages: Message[];
  iterations: number;
  toolCalls: ToolResult[];
}
