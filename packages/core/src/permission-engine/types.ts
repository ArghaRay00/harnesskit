import type { PermissionLevel } from "../tool-registry/types.js";

export type PermissionDecision = "allow" | "deny";

export interface PermissionRequest {
  tool: string;
  input: unknown;
  permissionLevel: PermissionLevel;
}

export interface DenialRecord {
  tool: string;
  timestamp: number;
  reason?: string;
}

export interface PermissionHandler {
  onAsk: (request: PermissionRequest) => Promise<boolean>;
}

export interface PermissionEngineConfig {
  maxConsecutiveDenials?: number; // circuit breaker threshold, default 3
}

export interface ClassificationRule {
  pattern: string | RegExp;
  level: PermissionLevel;
}
