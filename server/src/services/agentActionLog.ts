import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type { Config } from "../config.ts";
import { sendEnvelope } from "../protocol/respond.ts";
import type { AgentAction, PlaceId } from "../../../shared/protocol.ts";

export interface AgentActionLogEntry {
  timestamp: string;
  tool: string;
  args: Record<string, unknown>;
  result: "success" | "error";
  summary: string;
}

export class AgentActionLog {
  private readonly entries: AgentActionLogEntry[] = [];

  constructor(private readonly config: Config, private readonly connections: Set<WebSocket>) {}

  append(placeId: PlaceId, tool: string, args: Record<string, unknown>, result: "success" | "error", extra?: { summary?: string; beforeLength?: number; afterLength?: number }): AgentActionLogEntry {
    const entry: AgentActionLogEntry = {
      timestamp: new Date().toISOString(),
      tool,
      args: this.sanitizeArgs(args),
      result,
      summary: extra?.summary ?? this.summarize(tool, args, extra),
    };
    this.entries.unshift(entry);
    this.entries.splice(200);
    const file = path.join(this.config.dataDirectory, "ai", encodeURIComponent(placeId), "actions.jsonl");
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
    this.broadcast(placeId, entry);
    return entry;
  }

  recent(): AgentActionLogEntry[] {
    return [...this.entries];
  }

  private broadcast(placeId: PlaceId, entry: AgentActionLogEntry): void {
    const payload: AgentAction = { timestamp: entry.timestamp, summary: entry.summary, tool: entry.tool };
    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) sendEnvelope(ws, "agent:action", randomUUID(), placeId, payload);
    }
  }

  private sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const clone = { ...args };
    if (typeof clone.content === "string") clone.content = `[${clone.content.length} chars]`;
    if (typeof clone.source === "string") clone.source = `[${clone.source.length} chars]`;
    return clone;
  }

  private summarize(tool: string, args: Record<string, unknown>, extra?: { beforeLength?: number; afterLength?: number }): string {
    const pathArg = String(args.path ?? args.from ?? "script");
    switch (tool) {
      case "script_create": return `Created ${pathArg}`;
      case "script_write": return `Modified ${pathArg}${extra?.beforeLength !== undefined && extra.afterLength !== undefined ? ` (${extra.beforeLength} → ${extra.afterLength} chars)` : ""}`;
      case "script_delete": return `Deleted ${pathArg}`;
      case "script_rename": return `Renamed ${String(args.from)} → ${String(args.to)}`;
      case "script_read": return `Read ${pathArg}`;
      case "script_list": return "Listed scripts";
      case "script_restore": return `Restored ${pathArg} to ${String(args.toCommit)}`;
      case "git_commit": return `Committed: ${String(args.message ?? "auto commit")}`;
      case "git_status": return "Checked git status";
      case "git_log": return "Read git log";
      case "git_diff": return `Diffed ${pathArg}`;
      default: return `Ran ${tool}`;
    }
  }
}
