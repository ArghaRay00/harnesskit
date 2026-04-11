/**
 * File Organizer — Level 1 agent example (no model, $0)
 *
 * Demonstrates harnesskit's core triad:
 *   - tool-registry: three tools (list, classify, move)
 *   - permission-engine: move requires confirmation
 *   - query-loop: rule-based decision function drives the loop
 *
 * Run: pnpm --filter @harnesskit/example-file-organizer start
 */

import { z } from "zod";
import {
  ToolRegistry,
  PermissionEngine,
  QueryLoop,
  type DecisionFn,
  type Message,
  type ToolResult,
} from "@harnesskit/core";

// --- Simulated filesystem ---
const files = [
  { name: "report.pdf", dir: "inbox" },
  { name: "photo.jpg", dir: "inbox" },
  { name: "notes.md", dir: "inbox" },
  { name: "script.ts", dir: "inbox" },
  { name: "data.csv", dir: "inbox" },
];

const EXT_TO_CATEGORY: Record<string, string> = {
  pdf: "documents",
  doc: "documents",
  docx: "documents",
  jpg: "images",
  png: "images",
  gif: "images",
  md: "notes",
  txt: "notes",
  ts: "code",
  js: "code",
  py: "code",
  csv: "data",
  json: "data",
};

// --- Tools ---
const registry = new ToolRegistry();

registry.register({
  name: "file.list",
  description: "Lists files in a directory",
  schema: z.object({ dir: z.string() }),
  permissionLevel: "allow",
  execute: async ({ dir }) => {
    return files.filter((f) => f.dir === dir).map((f) => f.name);
  },
});

registry.register({
  name: "file.classify",
  description: "Classifies a file by extension",
  schema: z.object({ filename: z.string() }),
  permissionLevel: "allow",
  execute: async ({ filename }) => {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return { filename, category: EXT_TO_CATEGORY[ext] ?? "other" };
  },
});

registry.register({
  name: "file.move",
  description: "Moves a file to a target directory",
  schema: z.object({ filename: z.string(), targetDir: z.string() }),
  permissionLevel: "ask",
  execute: async ({ filename, targetDir }) => {
    const file = files.find((f) => f.name === filename);
    if (!file) throw new Error(`File "${filename}" not found`);
    const oldDir = file.dir;
    file.dir = targetDir;
    return { moved: filename, from: oldDir, to: targetDir };
  },
});

// --- Permission handler (auto-approve for this example) ---
const permissionEngine = new PermissionEngine({
  onAsk: async (req) => {
    console.log(`  [permission] Allow ${req.tool}? → yes (auto-approved)`);
    return true;
  },
});

// --- Level 1 decision function (pure rules, no model) ---

type Phase = "list" | "classify" | "move" | "done";

function createDecisionFn(): DecisionFn {
  let phase: Phase = "list";
  let filesToClassify: string[] = [];
  let classifications: Array<{ filename: string; category: string }> = [];
  let moveIndex = 0;

  return async (messages: readonly Message[]) => {
    const lastResult = [...messages]
      .reverse()
      .find((m) => m.role === "tool_result")?.toolResult;

    switch (phase) {
      case "list": {
        phase = "classify";
        return {
          type: "tool_call",
          toolCall: { name: "file.list", input: { dir: "inbox" } },
        };
      }

      case "classify": {
        // After listing, classify each file
        if (lastResult?.success && lastResult.tool === "file.list") {
          filesToClassify = lastResult.data as string[];
        }

        if (lastResult?.success && lastResult.tool === "file.classify") {
          classifications.push(lastResult.data as { filename: string; category: string });
        }

        if (classifications.length < filesToClassify.length) {
          const nextFile = filesToClassify[classifications.length];
          return {
            type: "tool_call",
            toolCall: { name: "file.classify", input: { filename: nextFile } },
          };
        }

        // All classified, move to move phase
        phase = "move";
        moveIndex = 0;
        // fall through
      }

      case "move": {
        if (moveIndex < classifications.length) {
          const { filename, category } = classifications[moveIndex];
          moveIndex++;
          return {
            type: "tool_call",
            toolCall: {
              name: "file.move",
              input: { filename, targetDir: category },
            },
          };
        }

        phase = "done";
        const summary = classifications
          .map((c) => `  ${c.filename} → ${c.category}/`)
          .join("\n");
        return {
          type: "response",
          response: `Organized ${classifications.length} files:\n${summary}`,
        };
      }

      default:
        return { type: "done" };
    }
  };
}

// --- Run ---
async function main() {
  console.log("File Organizer — Level 1 Agent (no model, $0)\n");
  console.log("Before:", files.map((f) => `${f.dir}/${f.name}`).join(", "));
  console.log();

  const loop = new QueryLoop({
    registry,
    permissionEngine,
    decide: createDecisionFn(),
    onMessage: (msg) => {
      if (msg.role === "tool_result" && msg.toolResult?.success) {
        console.log(`  [${msg.toolResult.tool}] ${JSON.stringify(msg.toolResult.data)}`);
      }
    },
  });

  const result = await loop.run("Organize all files in inbox");

  console.log();
  console.log("Agent response:", result.messages.at(-1)?.content);
  console.log(`\nIterations: ${result.iterations}, Tool calls: ${result.toolCalls.length}`);
  console.log("After:", files.map((f) => `${f.dir}/${f.name}`).join(", "));
}

main().catch(console.error);
