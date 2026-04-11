import { describe, it, expect, vi } from "vitest";
import { PermissionEngine } from "../src/permission-engine/engine.js";
import { classifyPermission } from "../src/permission-engine/classifier.js";

describe("PermissionEngine", () => {
  it("auto-allows tools with allow permission", async () => {
    const engine = new PermissionEngine({ onAsk: vi.fn() });
    const result = await engine.evaluate({
      tool: "read",
      input: {},
      permissionLevel: "allow",
    });
    expect(result).toBe("allow");
  });

  it("auto-denies tools with deny permission", async () => {
    const engine = new PermissionEngine({ onAsk: vi.fn() });
    const result = await engine.evaluate({
      tool: "danger",
      input: {},
      permissionLevel: "deny",
    });
    expect(result).toBe("deny");
  });

  it("calls onAsk for ask permission and allows", async () => {
    const onAsk = vi.fn().mockResolvedValue(true);
    const engine = new PermissionEngine({ onAsk });
    const result = await engine.evaluate({
      tool: "write",
      input: { path: "/tmp/test" },
      permissionLevel: "ask",
    });
    expect(result).toBe("allow");
    expect(onAsk).toHaveBeenCalledOnce();
  });

  it("calls onAsk for ask permission and denies", async () => {
    const onAsk = vi.fn().mockResolvedValue(false);
    const engine = new PermissionEngine({ onAsk });
    const result = await engine.evaluate({
      tool: "write",
      input: {},
      permissionLevel: "ask",
    });
    expect(result).toBe("deny");
  });

  it("tracks denial records", async () => {
    const onAsk = vi.fn().mockResolvedValue(false);
    const engine = new PermissionEngine({ onAsk });
    await engine.evaluate({ tool: "write", input: {}, permissionLevel: "ask" });
    const denials = engine.getDenials();
    expect(denials).toHaveLength(1);
    expect(denials[0].tool).toBe("write");
  });

  it("circuit breaks after consecutive denials", async () => {
    const onAsk = vi.fn().mockResolvedValue(false);
    const engine = new PermissionEngine({ onAsk }, { maxConsecutiveDenials: 2 });

    await engine.evaluate({ tool: "write", input: {}, permissionLevel: "ask" });
    await engine.evaluate({ tool: "write", input: {}, permissionLevel: "ask" });
    // Third call should auto-deny without calling onAsk
    const callsBefore = onAsk.mock.calls.length;
    const result = await engine.evaluate({
      tool: "write",
      input: {},
      permissionLevel: "ask",
    });
    expect(result).toBe("deny");
    expect(onAsk.mock.calls.length).toBe(callsBefore); // not called again
  });

  it("resets denials for a specific tool", async () => {
    const onAsk = vi.fn().mockResolvedValue(false);
    const engine = new PermissionEngine({ onAsk }, { maxConsecutiveDenials: 2 });
    await engine.evaluate({ tool: "write", input: {}, permissionLevel: "ask" });
    await engine.evaluate({ tool: "write", input: {}, permissionLevel: "ask" });
    engine.resetDenials("write");
    // Should ask again now
    onAsk.mockResolvedValueOnce(true);
    const result = await engine.evaluate({
      tool: "write",
      input: {},
      permissionLevel: "ask",
    });
    expect(result).toBe("allow");
  });
});

describe("classifyPermission", () => {
  const rules = [
    { pattern: /^file\.read/, level: "allow" as const },
    { pattern: /^file\.delete/, level: "ask" as const },
    { pattern: "dangerous.tool", level: "deny" as const },
  ];

  it("matches regex rules", () => {
    expect(classifyPermission("file.read.json", rules)).toBe("allow");
    expect(classifyPermission("file.delete.all", rules)).toBe("ask");
  });

  it("matches string rules", () => {
    expect(classifyPermission("dangerous.tool", rules)).toBe("deny");
  });

  it("falls back to default", () => {
    expect(classifyPermission("unknown.tool", rules)).toBe("ask");
    expect(classifyPermission("unknown.tool", rules, "deny")).toBe("deny");
  });
});
