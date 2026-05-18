import { AppError } from "../errors.ts";
import type { Handler, HandlerContext } from "../types.ts";
import { ErrorCode, type ClientToServerMessage, type HistoryVersion, type ScriptClassName, type ScriptRecord, type ScriptRef } from "../../../shared/protocol.ts";

function payload(message: ClientToServerMessage): Record<string, unknown> {
  return message.payload as Record<string, unknown>;
}

function stringField(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.length === 0) throw new AppError(ErrorCode.INVALID_PAYLOAD, `Missing ${key}`);
  return value;
}

function sourceField(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string") throw new AppError(ErrorCode.INVALID_PAYLOAD, `Invalid ${key}`);
  return value;
}

function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new AppError(ErrorCode.INVALID_PAYLOAD, `Invalid ${key}`);
  return value;
}

function className(value: unknown): ScriptClassName {
  if (value === "Script" || value === "LocalScript" || value === "ModuleScript") return value;
  throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid className");
}

function scriptSnapshot(obj: unknown): Array<{ path: string; className: ScriptClassName; source: string; uniqueId?: string }> {
  if (!Array.isArray(obj)) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid scripts");
  return obj.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid script snapshot item");
    const record = item as Record<string, unknown>;
    return {
      path: stringField(record, "path"),
      uniqueId: optionalString(record, "uniqueId"),
      className: className(record.className),
      source: sourceField(record, "source"),
    };
  });
}

function historyVersion(script: ScriptRecord, action: HistoryVersion["action"], summary?: string): HistoryVersion {
  return { versionId: script.versionId, path: script.path, uniqueId: script.uniqueId, className: script.className, source: script.source, action, timestamp: script.updatedAt, summary, actor: "daemon" };
}

function scriptRefs(p: Record<string, unknown>): ScriptRef[] {
  if (Array.isArray(p.refs)) {
    return p.refs.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid script ref");
      const record = item as Record<string, unknown>;
      return { path: stringField(record, "path"), uniqueId: optionalString(record, "uniqueId") };
    });
  }
  if (!Array.isArray(p.paths)) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid paths");
  return p.paths.map((path) => {
    if (typeof path !== "string" || path.length === 0) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid path");
    return { path };
  });
}

function emit(context: HandlerContext, placeId: string, kind: HistoryVersion["action"], script: ScriptRecord, history: HistoryVersion, oldPath?: string, origin = "daemon"): void {
  context.watchService.broadcast(placeId, { kind, path: script.path, uniqueId: script.uniqueId, oldPath, script, historyVersion: history, origin });
}

function messageOrigin(p: Record<string, unknown>): "daemon" | "studio-plugin" {
  return optionalString(p, "origin") === "studio-plugin" ? "studio-plugin" : "daemon";
}

function recordStudioAction(context: HandlerContext, placeId: string, origin: string, tool: string, summary: string): void {
  if (origin === "studio-plugin") context.agentService.recordAction(placeId, { timestamp: new Date().toISOString(), tool, summary });
}

export const scriptHandlers: Record<string, Handler> = {
  async "script:read"(message, context) {
    const p = payload(message);
    const script = await context.placeStore.read(message.placeId, stringField(p, "path"), optionalString(p, "uniqueId"));
    return { script };
  },

  async "script:create"(message, context) {
    const p = payload(message);
    const origin = messageOrigin(p);
    const result = await context.placeStore.create(message.placeId, {
      path: stringField(p, "path"),
      uniqueId: optionalString(p, "uniqueId"),
      className: className(p.className),
      source: sourceField(p, "source"),
      overwrite: p.overwrite === true,
      pendingStudioDeploy: p.pendingStudioDeploy === true,
    });
    const entry = context.historyStore.append(message.placeId, {
      timestamp: result.script.updatedAt,
      type: "created",
      previousContent: result.previous?.source ?? null,
      newContent: result.script.source,
      scriptPath: result.script.path,
      versionId: result.script.versionId,
      className: result.script.className,
      uniqueId: result.script.uniqueId,
      summary: optionalString(p, "summary"),
      actor: origin,
    });
    emit(context, message.placeId, "created", result.script, entry, undefined, origin);
    recordStudioAction(context, message.placeId, origin, "script_create", `Created ${result.script.path}`);
    return { script: result.script, historyVersion: entry };
  },

  async "script:write"(message, context) {
    const p = payload(message);
    const origin = messageOrigin(p);
    const result = await context.placeStore.write(message.placeId, {
      path: stringField(p, "path"),
      uniqueId: optionalString(p, "uniqueId"),
      source: sourceField(p, "source"),
      className: p.className === undefined ? undefined : className(p.className),
      expectedVersionId: optionalString(p, "expectedVersionId"),
      pendingStudioDeploy: p.pendingStudioDeploy === true,
    });
    const entry = context.historyStore.append(message.placeId, {
      timestamp: result.script.updatedAt,
      type: "modified",
      previousContent: result.previous.source,
      newContent: result.script.source,
      scriptPath: result.script.path,
      versionId: result.script.versionId,
      className: result.script.className,
      uniqueId: result.script.uniqueId,
      summary: optionalString(p, "summary"),
      actor: origin,
    });
    emit(context, message.placeId, "updated", result.script, entry, undefined, origin);
    recordStudioAction(context, message.placeId, origin, "script_write", `Modified ${result.script.path}`);
    return { script: result.script, historyVersion: entry };
  },

  async "script:delete"(message, context) {
    const p = payload(message);
    const origin = messageOrigin(p);
    const result = await context.placeStore.delete(message.placeId, { path: stringField(p, "path"), uniqueId: optionalString(p, "uniqueId"), expectedVersionId: optionalString(p, "expectedVersionId") });
    const entry = context.historyStore.append(message.placeId, {
      timestamp: result.deleted.updatedAt,
      type: "deleted",
      previousContent: result.previous.source,
      newContent: null,
      scriptPath: result.previous.path,
      versionId: result.deleted.versionId,
      className: result.previous.className,
      uniqueId: result.previous.uniqueId,
      summary: optionalString(p, "summary"),
      actor: origin,
    });
    emit(context, message.placeId, "deleted", result.deleted, entry, undefined, origin);
    recordStudioAction(context, message.placeId, origin, "script_delete", `Deleted ${result.previous.path}`);
    return { path: result.previous.path, deleted: true, historyVersion: entry };
  },

  async "script:rename"(message, context) {
    const p = payload(message);
    const origin = messageOrigin(p);
    const result = await context.placeStore.rename(message.placeId, {
      fromPath: stringField(p, "fromPath"),
      uniqueId: optionalString(p, "uniqueId"),
      toPath: stringField(p, "toPath"),
      expectedVersionId: optionalString(p, "expectedVersionId"),
      pendingStudioDeploy: p.pendingStudioDeploy === true,
    });
    const entry = context.historyStore.append(message.placeId, {
      timestamp: result.script.updatedAt,
      type: "renamed",
      previousContent: result.previous.source,
      newContent: result.script.source,
      scriptPath: result.script.path,
      versionId: result.script.versionId,
      className: result.script.className,
      uniqueId: result.script.uniqueId,
      summary: optionalString(p, "summary"),
      actor: origin,
      oldPath: result.previous.path,
    });
    emit(context, message.placeId, "renamed", result.script, entry, result.previous.path, origin);
    recordStudioAction(context, message.placeId, origin, "script_rename", `Renamed ${result.previous.path} → ${result.script.path}`);
    return { fromPath: result.previous.path, toPath: result.script.path, script: result.script, historyVersion: entry };
  },

  async "script:restore"(message, context) {
    const p = payload(message);
    const scriptPath = stringField(p, "path");
    const versionId = stringField(p, "versionId");
    const sourceVersion = context.historyStore.getVersion(message.placeId, scriptPath, versionId);
    const restored = await context.placeStore.restore(message.placeId, {
      path: scriptPath,
      uniqueId: optionalString(p, "uniqueId") ?? sourceVersion.uniqueId,
      source: sourceVersion.newContent ?? sourceVersion.previousContent ?? "",
      className: sourceVersion.className,
      pendingStudioDeploy: p.pendingStudioDeploy === true,
    });
    const entry = context.historyStore.append(message.placeId, {
      timestamp: restored.script.updatedAt,
      type: "modified",
      previousContent: restored.previous?.source ?? null,
      newContent: restored.script.source,
      scriptPath: restored.script.path,
      versionId: restored.script.versionId,
      className: restored.script.className,
      uniqueId: restored.script.uniqueId,
      summary: optionalString(p, "summary") ?? `Restored ${versionId}`,
      actor: "daemon",
    });
    const history = { ...entry, action: "restored" as const };
    emit(context, message.placeId, "restored", restored.script, history);
    context.agentService.recordAction(message.placeId, { timestamp: new Date().toISOString(), tool: "script_restore", summary: `Restored ${restored.script.path}` });
    return { script: restored.script, restoredFromVersionId: versionId, historyVersion: history };
  },

  async "script:syncSnapshot"(message, context) {
    const p = payload(message);
    const result = await context.placeStore.syncSnapshot(message.placeId, { scripts: scriptSnapshot(p.scripts) });
    for (const script of result.scripts) {
      if (context.historyStore.hasHistory(message.placeId, script.path)) continue;
      context.historyStore.append(message.placeId, {
        timestamp: script.updatedAt,
        type: "created",
        previousContent: null,
        newContent: script.source,
        scriptPath: script.path,
        versionId: script.versionId,
        className: script.className,
        uniqueId: script.uniqueId,
        summary: "Initial Studio snapshot",
        actor: "studio-snapshot",
      });
    }
    for (const deleted of result.deleted) {
      const history = historyVersion(deleted, "deleted", "Removed from daemon during Studio snapshot sync");
      emit(context, message.placeId, "deleted", deleted, history, undefined, "studio-snapshot");
    }
    return { scripts: result.scripts, deleted: result.deleted, count: result.scripts.length, deletedCount: result.deleted.length };
  },

  async "script:ackDeploy"(message, context) {
    const p = payload(message);
    const acknowledged = await context.placeStore.ackDeploy(message.placeId, scriptRefs(p));
    return { acknowledged };
  },

  async "script:cleanupStale"(message, context) {
    const p = payload(message);
    if (!Array.isArray(p.paths)) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid paths");
    const paths = p.paths.map((path) => {
      if (typeof path !== "string" || path.length === 0) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid path");
      return path;
    });
    const result = await context.placeStore.cleanupStale(message.placeId, {
      paths,
      confirm: p.confirm === true,
      includeLegacy: p.includeLegacy === true,
      includePending: p.includePending === true,
    });
    if (p.confirm === true) {
      context.agentService.recordAction(message.placeId, { timestamp: new Date().toISOString(), tool: "script_cleanup_stale", summary: `Cleaned ${result.cleaned.length} stale script record${result.cleaned.length === 1 ? "" : "s"}` });
      for (const cleaned of result.cleaned) {
        context.historyStore.append(message.placeId, {
          timestamp: cleaned.updatedAt,
          type: "deleted",
          previousContent: cleaned.source,
          newContent: null,
          scriptPath: cleaned.path,
          versionId: cleaned.versionId,
          className: cleaned.className,
          uniqueId: cleaned.uniqueId,
          summary: optionalString(p, "summary") ?? "Cleaned stale daemon record",
          actor: "daemon-cleanup",
        });
      }
    }
    return {
      ...result,
      candidateCount: result.candidates.length,
      cleanedCount: result.cleaned.length,
      skippedCount: result.skipped.length,
    };
  },

  async "script:list"(message, context) {
    const p = payload(message);
    const scripts = await context.placeStore.list(message.placeId, { includeSource: p.includeSource === true, includeDeleted: p.includeDeleted === true });
    return { scripts, count: scripts.length, totalBytes: scripts.reduce((sum, script) => sum + script.size, 0) };
  },
};
