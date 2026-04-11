import type { Message } from "./types.js";

export function buildContext(
  messages: readonly Message[],
  _maxTokenEstimate?: number
): Message[] {
  // Simple passthrough for now.
  // Future: context-manager module will add cache-aware compaction
  // (snip → micro → collapse → full) pipeline here.
  return [...messages];
}
