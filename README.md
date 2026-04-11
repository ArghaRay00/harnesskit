# harnesskit

Model-agnostic agent orchestration framework.

An agent is a decision loop that improves over time. The model is optional — it enhances specific decision points, but doesn't enable the system. Rule-based agents handle 90% of real-world situations at zero cost.

> The alpha isn't the model. The alpha is the harness.

## Architecture

```
@harnesskit/core
├── tool-registry       — Zod schemas, permission levels, validated execution
├── permission-engine   — deny → ask → allow cascade, denial tracking, circuit breaker
├── query-loop          — input → context → decide → tool calls → repeat
├── memory              — 4-type taxonomy, side-query selection, auto-dream  (planned)
├── context-manager     — cache-aware compaction pipeline                    (planned)
├── agent-spawner       — fork with shared context, worktree isolation       (planned)
├── hook-system         — lifecycle events, 4 hook types                     (planned)
├── model-router        — tiered selection, retry, fallback                  (planned)
├── drift-detector      — golden image + snapshot + diff                     (planned)
└── bridge              — WebSocket/SSE bidirectional, crash recovery        (planned)

@harnesskit/providers
├── ollama              — Local model adapter (Qwen 7B, etc.)               (planned)
└── together            — Together.ai cloud adapter                         (planned)
```

Three agent intelligence levels, same architecture:

| Level | Decision layer | Cost | Coverage |
|-------|---------------|------|----------|
| **1: Rule-based** | switch/case, decision trees | $0 | ~90% |
| **2: Hybrid** | local model (Ollama/Qwen 7B) | $0 | ~97% |
| **3: Full agent** | cloud model (DeepSeek R1, Claude) | ~$1-3/day | ~99.5% |

## Status

**v0.1.0** — core triad shipped. 22 tests passing.

| Module | Status |
|--------|--------|
| tool-registry | shipped |
| permission-engine | shipped |
| query-loop | shipped |
| providers (Ollama, Together.ai) | next |
| memory | planned |
| hook-system | planned |
| bridge | planned |
| context-manager | planned |
| agent-spawner | planned |
| model-router | planned |
| drift-detector | planned |

## Roadmap

| Phase | Timeline | What |
|-------|----------|------|
| **Core triad** | Week 1-2 | tool-registry + permission-engine + query-loop |
| **Providers** | Week 3 | Ollama + Together.ai adapters → Level 2/3 agents |
| **Memory** | Week 4 | 4-type taxonomy, side-query selection, background extraction |
| **Hooks** | Week 5 | 25 lifecycle events, 4 hook types (command/prompt/http/agent) |
| **Bridge** | Week 6 | WebSocket/SSE bidirectional, permission forwarding, crash recovery |
| **First real agent** | Week 7+ | Built on harnesskit (deployer v2 or ghostline) |

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

See [`examples/file-organizer/`](examples/file-organizer/) for a complete Level 1 agent that classifies and organizes files using zero model calls.

## Key concepts

**DecisionFn** — the core abstraction. Not a model interface. A function that takes messages and returns a decision (tool call, response, or done). Level 1 implements this with switch/case. Level 2+ with a model. The framework doesn't care.

**Permission cascade** — every tool call passes through the permission engine. Tools declare their level (allow/ask/deny). The engine tracks denials and circuit-breaks after repeated rejections.

**Gate-Decide-Act-Learn** — the meta-pattern applied to every intelligent feature:
- **Gate:** Should I run? (permission check, drift detection, circuit breaker)
- **Decide:** How? (rule-based or model-enhanced)
- **Act:** Execute with validation and error handling
- **Learn:** Track denials, log results, feed back into gates

## Development

```bash
pnpm install
pnpm -r build
pnpm -r test       # 22 tests
```

## License

MIT
