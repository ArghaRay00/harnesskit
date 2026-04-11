import type {
  PermissionDecision,
  PermissionRequest,
  DenialRecord,
  PermissionHandler,
  PermissionEngineConfig,
} from "./types.js";

export class PermissionEngine {
  private handler: PermissionHandler;
  private maxDenials: number;
  private denials: DenialRecord[] = [];
  private consecutiveDenials = new Map<string, number>();

  constructor(handler: PermissionHandler, config?: PermissionEngineConfig) {
    this.handler = handler;
    this.maxDenials = config?.maxConsecutiveDenials ?? 3;
  }

  async evaluate(request: PermissionRequest): Promise<PermissionDecision> {
    if (request.permissionLevel === "allow") {
      this.consecutiveDenials.set(request.tool, 0);
      return "allow";
    }

    if (request.permissionLevel === "deny") {
      this.recordDenial(request.tool, "tool permission level is deny");
      return "deny";
    }

    // permissionLevel === "ask"
    // Circuit breaker: if denied too many times in a row, auto-deny
    const consecutive = this.consecutiveDenials.get(request.tool) ?? 0;
    if (consecutive >= this.maxDenials) {
      this.recordDenial(request.tool, "circuit breaker: too many denials");
      return "deny";
    }

    const allowed = await this.handler.onAsk(request);

    if (allowed) {
      this.consecutiveDenials.set(request.tool, 0);
      return "allow";
    }

    this.recordDenial(request.tool, "user denied");
    return "deny";
  }

  recordDenial(tool: string, reason?: string): void {
    this.denials.push({ tool, timestamp: Date.now(), reason });
    const current = this.consecutiveDenials.get(tool) ?? 0;
    this.consecutiveDenials.set(tool, current + 1);
  }

  getDenials(): readonly DenialRecord[] {
    return this.denials;
  }

  resetDenials(tool?: string): void {
    if (tool) {
      this.denials = this.denials.filter((d) => d.tool !== tool);
      this.consecutiveDenials.delete(tool);
    } else {
      this.denials = [];
      this.consecutiveDenials.clear();
    }
  }
}
