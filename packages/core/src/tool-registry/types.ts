import type { z } from "zod";

export type PermissionLevel = "allow" | "ask" | "deny";
export type ConcurrencyType = "serial" | "parallel";

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  permissionLevel: PermissionLevel;
  concurrency?: ConcurrencyType;
  execute: (input: TInput) => Promise<TOutput>;
}

export interface ToolResult<T = unknown> {
  tool: string;
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
}

export interface ToolSummary {
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
}
