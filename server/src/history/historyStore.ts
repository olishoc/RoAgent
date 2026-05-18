import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AppLogger } from "../logger.ts";
import type { Config } from "../config.ts";
import { AppError } from "../errors.ts";
import { ErrorCode, type HistoryVersion, type ScriptAction, type ScriptClassName, type ScriptPath, type VersionId } from "../../../shared/protocol.ts";

export type JsonlHistoryType = "modified" | "deleted" | "created" | "renamed";

export interface JsonlHistoryEntry {
  timestamp: string;
  type: JsonlHistoryType;
  previousContent: string | null;
  newContent: string | null;
  scriptPath: ScriptPath;
  versionId: VersionId;
  className: ScriptClassName;
  uniqueId?: string;
  summary?: string;
  actor?: string;
  oldPath?: ScriptPath;
  commitHash?: string;
}

export class HistoryStore {
  constructor(private readonly config: Config, private readonly logger: AppLogger) {}

  append(placeId: string, entry: JsonlHistoryEntry): HistoryVersion {
    const file = this.fileFor(placeId, entry.scriptPath);
    mkdirSync(path.dirname(file), { recursive: true });
    const versionNumber = this.readEntries(placeId, entry.scriptPath).length + 1;
    appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
    return this.toHistoryVersion(entry, true, versionNumber);
  }

  hasHistory(placeId: string, scriptPath: ScriptPath): boolean {
    return this.readEntries(placeId, scriptPath).length > 0;
  }

  get(placeId: string, scriptPath: ScriptPath, includeSource: boolean): HistoryVersion[] {
    return this.readEntries(placeId, scriptPath).map((entry, index) => this.toHistoryVersion(entry, includeSource, index + 1));
  }

  getVersion(placeId: string, scriptPath: ScriptPath, versionId: VersionId): JsonlHistoryEntry {
    const entry = this.readEntries(placeId, scriptPath).find((candidate) => candidate.versionId === versionId);
    if (!entry) throw new AppError(ErrorCode.NOT_FOUND, "History version not found");
    return entry;
  }

  getDeleted(placeId: string, includeSource: boolean): Array<{ path: ScriptPath; uniqueId?: string; className: ScriptClassName; deletedAt: string; lastVersionId: VersionId; lastKnownSource?: string; size: number }> {
    const dir = path.join(this.config.dataDirectory, "history", encodeURIComponent(placeId));
    if (!existsSync(dir)) return [];
    const results = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".jsonl")) continue;
      const scriptPath = decodeURIComponent(file.slice(0, -".jsonl".length));
      const entries = this.readEntries(placeId, scriptPath);
      const latestByIdentity = new Map<string, JsonlHistoryEntry>();
      for (const entry of entries) {
        latestByIdentity.set(entry.uniqueId ? `uid:${entry.uniqueId}` : `path:${entry.scriptPath}`, entry);
      }
      for (const last of latestByIdentity.values()) {
        if (last.type !== "deleted") continue;
        const content = last.previousContent ?? last.newContent ?? "";
        results.push({
          path: last.scriptPath,
          uniqueId: last.uniqueId,
          className: last.className,
          deletedAt: last.timestamp,
          lastVersionId: last.versionId,
          lastKnownSource: includeSource ? content : undefined,
          size: content.length,
        });
      }
    }
    return results.sort((a, b) => a.path.localeCompare(b.path) || String(a.uniqueId ?? "").localeCompare(String(b.uniqueId ?? "")));
  }

  private readEntries(placeId: string, scriptPath: ScriptPath): JsonlHistoryEntry[] {
    const file = this.fileFor(placeId, scriptPath);
    if (!existsSync(file)) return [];
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    const entries: JsonlHistoryEntry[] = [];
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      try {
        const parsed = JSON.parse(line) as JsonlHistoryEntry;
        if (!this.isValidEntry(parsed)) throw new Error("invalid history entry shape");
        entries.push(parsed);
      } catch (error) {
        this.logger.warn({ event: "history-corrupt-line" }, `Skipped corrupt history line ${index + 1}`);
        this.logger.error(this.logger.sanitizeError(error), "History line parse failure");
      }
    });
    return entries;
  }

  private isValidEntry(entry: JsonlHistoryEntry): boolean {
    return typeof entry.timestamp === "string"
      && ["modified", "deleted", "created", "renamed"].includes(entry.type)
      && typeof entry.scriptPath === "string"
      && typeof entry.versionId === "string"
      && (entry.uniqueId === undefined || typeof entry.uniqueId === "string")
      && ["Script", "LocalScript", "ModuleScript"].includes(entry.className)
      && (entry.previousContent === null || typeof entry.previousContent === "string")
      && (entry.newContent === null || typeof entry.newContent === "string");
  }

  private fileFor(placeId: string, scriptPath: ScriptPath): string {
    return path.join(this.config.dataDirectory, "history", encodeURIComponent(placeId), `${encodeURIComponent(scriptPath)}.jsonl`);
  }

  private toHistoryVersion(entry: JsonlHistoryEntry, includeSource: boolean, versionNumber?: number): HistoryVersion {
    const action: ScriptAction = entry.type === "modified" ? "updated" : entry.type;
    const source = entry.type === "deleted" ? entry.previousContent ?? undefined : entry.newContent ?? undefined;
    return {
      versionNumber,
      versionId: entry.versionId,
      path: entry.scriptPath,
      uniqueId: entry.uniqueId,
      className: entry.className,
      source: includeSource ? source : undefined,
      action,
      timestamp: entry.timestamp,
      summary: entry.summary,
      actor: entry.actor,
      commitHash: entry.commitHash,
    };
  }
}
