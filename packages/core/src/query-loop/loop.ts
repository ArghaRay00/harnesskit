import type {
  Message,
  LoopConfig,
  LoopResult,
  DecisionFn,
} from "./types.js";
import type { ToolResult } from "../tool-registry/types.js";
import { buildContext } from "./context.js";

const DEFAULT_MAX_ITERATIONS = 50;

export class QueryLoop {
  private config: Required<
    Pick<LoopConfig, "registry" | "permissionEngine" | "decide" | "maxIterations">
  > & { onMessage?: LoopConfig["onMessage"] };

  constructor(config: LoopConfig) {
    this.config = {
      registry: config.registry,
      permissionEngine: config.permissionEngine,
      decide: config.decide,
      maxIterations: config.maxIterations ?? DEFAULT_MAX_ITERATIONS,
      onMessage: config.onMessage,
    };
  }

  async run(input: string): Promise<LoopResult> {
    const messages: Message[] = [];
    const toolCalls: ToolResult[] = [];
    let iterations = 0;

    const userMsg: Message = { role: "user", content: input };
    messages.push(userMsg);
    this.config.onMessage?.(userMsg);

    while (iterations < this.config.maxIterations) {
      iterations++;

      const context = buildContext(messages);
      const decision = await this.config.decide(context);

      if (decision.type === "done") {
        break;
      }

      if (decision.type === "response") {
        const assistantMsg: Message = {
          role: "assistant",
          content: decision.response ?? "",
        };
        messages.push(assistantMsg);
        this.config.onMessage?.(assistantMsg);
        break;
      }

      if (decision.type === "tool_call" && decision.toolCall) {
        const { name, input: toolInput } = decision.toolCall;

        // Check tool exists
        if (!this.config.registry.has(name)) {
          const errorMsg: Message = {
            role: "tool_result",
            content: `Tool "${name}" not found`,
            toolResult: {
              tool: name,
              success: false,
              error: `Tool "${name}" not found`,
              durationMs: 0,
            },
          };
          messages.push(errorMsg);
          this.config.onMessage?.(errorMsg);
          continue;
        }

        const tool = this.config.registry.get(name);

        // Permission check
        const permissionResult = await this.config.permissionEngine.evaluate({
          tool: name,
          input: toolInput,
          permissionLevel: tool.permissionLevel,
        });

        if (permissionResult === "deny") {
          const denialMsg: Message = {
            role: "tool_result",
            content: `Permission denied for tool "${name}"`,
            toolResult: {
              tool: name,
              success: false,
              error: "Permission denied",
              durationMs: 0,
            },
          };
          messages.push(denialMsg);
          this.config.onMessage?.(denialMsg);
          continue;
        }

        // Execute
        const result = await this.config.registry.execute(name, toolInput);
        toolCalls.push(result);

        const resultMsg: Message = {
          role: "tool_result",
          content: result.success
            ? JSON.stringify(result.data)
            : `Error: ${result.error}`,
          toolCall: { name, input: toolInput },
          toolResult: result,
        };
        messages.push(resultMsg);
        this.config.onMessage?.(resultMsg);
      }
    }

    return { messages, iterations, toolCalls };
  }
}
