import type { ToolDefinition, ToolResult, ToolSummary } from "./types.js";
import { validateInput } from "./validation.js";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  get(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found`);
    }
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolSummary[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      permissionLevel: t.permissionLevel,
    }));
  }

  async execute(name: string, rawInput: unknown): Promise<ToolResult> {
    const tool = this.get(name);
    const start = performance.now();

    const validation = validateInput(tool.schema, rawInput);
    if (!validation.success) {
      return {
        tool: name,
        success: false,
        error: validation.error,
        durationMs: performance.now() - start,
      };
    }

    try {
      const data = await tool.execute(validation.data);
      return {
        tool: name,
        success: true,
        data,
        durationMs: performance.now() - start,
      };
    } catch (err) {
      return {
        tool: name,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: performance.now() - start,
      };
    }
  }
}
