import type { PermissionLevel } from "../tool-registry/types.js";
import type { ClassificationRule } from "./types.js";

export function classifyPermission(
  toolName: string,
  rules: ClassificationRule[],
  fallback: PermissionLevel = "ask"
): PermissionLevel {
  for (const rule of rules) {
    const matches =
      typeof rule.pattern === "string"
        ? toolName === rule.pattern || toolName.startsWith(rule.pattern)
        : rule.pattern.test(toolName);

    if (matches) {
      return rule.level;
    }
  }
  return fallback;
}
