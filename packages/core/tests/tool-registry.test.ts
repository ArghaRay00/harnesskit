import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../src/tool-registry/registry.js";
import type { ToolDefinition } from "../src/tool-registry/types.js";

function echoTool(): ToolDefinition<{ text: string }, string> {
  return {
    name: "echo",
    description: "Echoes input text",
    schema: z.object({ text: z.string() }),
    permissionLevel: "allow",
    execute: async (input) => input.text,
  };
}

describe("ToolRegistry", () => {
  it("registers and retrieves a tool", () => {
    const registry = new ToolRegistry();
    registry.register(echoTool());
    expect(registry.has("echo")).toBe(true);
    expect(registry.get("echo").name).toBe("echo");
  });

  it("throws on duplicate registration", () => {
    const registry = new ToolRegistry();
    registry.register(echoTool());
    expect(() => registry.register(echoTool())).toThrow("already registered");
  });

  it("throws on unknown tool", () => {
    const registry = new ToolRegistry();
    expect(() => registry.get("nonexistent")).toThrow("not found");
  });

  it("lists registered tools", () => {
    const registry = new ToolRegistry();
    registry.register(echoTool());
    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      name: "echo",
      description: "Echoes input text",
      permissionLevel: "allow",
    });
  });

  it("executes a tool with valid input", async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool());
    const result = await registry.execute("echo", { text: "hello" });
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello");
    expect(result.tool).toBe("echo");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns validation error for invalid input", async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool());
    const result = await registry.execute("echo", { text: 123 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Validation failed");
  });

  it("catches execution errors", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "fail",
      description: "Always fails",
      schema: z.object({}),
      permissionLevel: "allow",
      execute: async () => {
        throw new Error("boom");
      },
    });
    const result = await registry.execute("fail", {});
    expect(result.success).toBe(false);
    expect(result.error).toBe("boom");
  });
});
