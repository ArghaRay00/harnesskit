import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { QueryLoop } from "../src/query-loop/loop.js";
import { ToolRegistry } from "../src/tool-registry/registry.js";
import { PermissionEngine } from "../src/permission-engine/engine.js";
import type { DecisionFn, Message } from "../src/query-loop/types.js";

function createTestRegistry() {
  const registry = new ToolRegistry();
  registry.register({
    name: "add",
    description: "Adds two numbers",
    schema: z.object({ a: z.number(), b: z.number() }),
    permissionLevel: "allow",
    execute: async ({ a, b }) => a + b,
  });
  registry.register({
    name: "restricted",
    description: "Needs permission",
    schema: z.object({}),
    permissionLevel: "ask",
    execute: async () => "done",
  });
  return registry;
}

describe("QueryLoop", () => {
  it("runs a single tool call and responds", async () => {
    const registry = createTestRegistry();
    const engine = new PermissionEngine({ onAsk: async () => true });

    let callCount = 0;
    const decide: DecisionFn = async (messages) => {
      callCount++;
      if (callCount === 1) {
        return { type: "tool_call", toolCall: { name: "add", input: { a: 2, b: 3 } } };
      }
      return { type: "response", response: "The answer is 5" };
    };

    const loop = new QueryLoop({ registry, permissionEngine: engine, decide });
    const result = await loop.run("What is 2 + 3?");

    expect(result.iterations).toBe(2);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].success).toBe(true);
    expect(result.toolCalls[0].data).toBe(5);
    expect(result.messages.at(-1)?.content).toBe("The answer is 5");
  });

  it("handles permission denial mid-loop", async () => {
    const registry = createTestRegistry();
    const engine = new PermissionEngine({ onAsk: async () => false });

    let callCount = 0;
    const decide: DecisionFn = async () => {
      callCount++;
      if (callCount === 1) {
        return { type: "tool_call", toolCall: { name: "restricted", input: {} } };
      }
      return { type: "response", response: "Permission was denied" };
    };

    const loop = new QueryLoop({ registry, permissionEngine: engine, decide });
    const result = await loop.run("Do the restricted thing");

    expect(result.toolCalls).toHaveLength(0);
    const denialMsg = result.messages.find(
      (m) => m.role === "tool_result" && m.content.includes("Permission denied")
    );
    expect(denialMsg).toBeDefined();
  });

  it("respects iteration limit", async () => {
    const registry = createTestRegistry();
    const engine = new PermissionEngine({ onAsk: async () => true });

    const decide: DecisionFn = async () => ({
      type: "tool_call",
      toolCall: { name: "add", input: { a: 1, b: 1 } },
    });

    const loop = new QueryLoop({
      registry,
      permissionEngine: engine,
      decide,
      maxIterations: 3,
    });
    const result = await loop.run("Loop forever");

    expect(result.iterations).toBe(3);
    expect(result.toolCalls).toHaveLength(3);
  });

  it("handles unknown tool gracefully", async () => {
    const registry = createTestRegistry();
    const engine = new PermissionEngine({ onAsk: async () => true });

    let callCount = 0;
    const decide: DecisionFn = async () => {
      callCount++;
      if (callCount === 1) {
        return { type: "tool_call", toolCall: { name: "nonexistent", input: {} } };
      }
      return { type: "done" };
    };

    const loop = new QueryLoop({ registry, permissionEngine: engine, decide });
    const result = await loop.run("Use a bad tool");

    const errorMsg = result.messages.find(
      (m) => m.content.includes("not found")
    );
    expect(errorMsg).toBeDefined();
  });

  it("fires onMessage callback", async () => {
    const registry = createTestRegistry();
    const engine = new PermissionEngine({ onAsk: async () => true });

    const decide: DecisionFn = async () => ({ type: "response", response: "hi" });
    const onMessage = vi.fn();

    const loop = new QueryLoop({
      registry,
      permissionEngine: engine,
      decide,
      onMessage,
    });
    await loop.run("hello");

    expect(onMessage).toHaveBeenCalledTimes(2); // user msg + assistant response
    expect(onMessage.mock.calls[0][0].role).toBe("user");
    expect(onMessage.mock.calls[1][0].role).toBe("assistant");
  });
});
