# harnesskit

Model-agnostic agent orchestration framework.

An agent is a decision loop that improves over time. The model is optional — it enhances specific decision points, but doesn't enable the system. Rule-based agents handle 90% of real-world situations at zero cost.

## Architecture

```
@harnesskit/core
├── tool-registry       — Zod schemas, permission levels, validated execution
├── permission-engine   — deny → ask → allow cascade, denial tracking, circuit breaker
└── query-loop          — input → context → decide → tool calls → repeat
```

Three agent intelligence levels, same architecture:

| Level | Decision layer | Cost | Coverage |
|-------|---------------|------|----------|
| **1: Rule-based** | switch/case, decision trees | $0 | ~90% |
| **2: Hybrid** | local model (Ollama/Qwen 7B) | $0 | ~97% |
| **3: Full agent** | cloud model (DeepSeek R1, Claude) | ~$1-3/day | ~99.5% |

## Install

```bash
npm install @harnesskit/core
```

## Quick start

```typescript
import { z } from "zod";
import {
  ToolRegistry,
  PermissionEngine,
  QueryLoop,
  type DecisionFn,
} from "@harnesskit/core";

// 1. Register tools
const registry = new ToolRegistry();
registry.register({
  name: "greet",
  description: "Greets a person",
  schema: z.object({ name: z.string() }),
  permissionLevel: "allow",
  execute: async ({ name }) => `Hello, ${name}!`,
});

// 2. Set up permissions
const permissions = new PermissionEngine({
  onAsk: async (req) => true, // auto-approve for demo
});

// 3. Define decision logic (Level 1: pure rules)
const decide: DecisionFn = async (messages) => {
  const lastMsg = messages.at(-1);
  if (lastMsg?.role === "user") {
    return {
      type: "tool_call",
      toolCall: { name: "greet", input: { name: "world" } },
    };
  }
  return { type: "response", response: `Result: ${lastMsg?.content}` };
};

// 4. Run the loop
const loop = new QueryLoop({ registry, permissionEngine: permissions, decide });
const result = await loop.run("Say hello");
console.log(result.messages.at(-1)?.content);
// → "Result: Hello, world!"
```

See `examples/file-organizer/` for a complete Level 1 agent.

## Development

```bash
pnpm install
pnpm -r build
pnpm -r test
```

## License

MIT
