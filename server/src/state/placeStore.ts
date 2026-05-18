import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Config } from "../config.ts";
import { AppError } from "../errors.ts";
import { ErrorCode, type ScriptClassName, type ScriptPath, type ScriptRecord, type ScriptRef, type VersionId } from "../../../shared/protocol.ts";

interface PlaceRegistryFile {
  scripts: ScriptRecord[];
  updatedAt: string;
}

export class PlaceStore {
  private readonly places = new Map<string, Map<ScriptPath, ScriptRecord>>();

  constructor(private readonly config: Config) {}

  getPlaceDirectory(placeId: string): string {
    return path.join(this.config.dataDirectory, "places", encodeURIComponent(placeId));
  }

  getRepoDirectory(placeId: string): string {
    return path.join(this.config.dataDirectory, "repos", encodeURIComponent(placeId));
  }

  listActivePlaces(): string[] {
    return [...this.places.keys()];
  }

  async list(placeId: string, options: { includeSource?: boolean; includeDeleted?: boolean } = {}): Promise<ScriptRecord[]> {
    const place = this.loadPlace(placeId);
    return [...place.values()]
      .filter((script) => !this.isProtectedScriptPath(script.path))
      .filter((script) => options.includeDeleted || !script.deleted)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((script) => options.includeSource ? { ...script } : ({ ...script, source: "" }));
  }

  async read(placeId: string, scriptPath: ScriptPath, uniqueId?: string): Promise<ScriptRecord> {
    const normalizedPath = this.normalizeScriptPath(scriptPath).path;
    this.validateScriptPath(normalizedPath);
    const script = this.findActiveScript(this.loadPlace(placeId), normalizedPath, uniqueId);
    if (!script) throw new AppError(ErrorCode.NOT_FOUND, "Script not found");
    return { ...script };
  }

  async create(placeId: string, input: { path: ScriptPath; className: ScriptClassName; source: string; overwrite?: boolean; pendingStudioDeploy?: boolean; uniqueId?: string }): Promise<{ script: ScriptRecord; previous?: ScriptRecord }> {
    const normalized = this.normalizeScriptPath(input.path, input.className);
    const scriptPath = normalized.path;
    const className = normalized.className ?? input.className;
    this.validateScriptInput(scriptPath, className, input.source);
    const place = this.loadPlace(placeId);
    const existing = this.findScript(place, scriptPath, input.uniqueId);
    if (existing && !existing.deleted && !input.overwrite) {
      throw new AppError(ErrorCode.INVALID_PAYLOAD, "Script already exists");
    }
    const now = new Date().toISOString();
    const script: ScriptRecord = {
      path: scriptPath,
      uniqueId: input.uniqueId,
      className,
      source: input.source,
      size: input.source.length,
      versionId: this.nextVersionId(),
      updatedAt: now,
      deleted: false,
      pendingStudioDeploy: input.pendingStudioDeploy === true,
    };
    place.set(this.scriptKey(scriptPath, input.uniqueId), script);
    this.savePlace(placeId);
    return { script: { ...script }, previous: existing ? { ...existing } : undefined };
  }

  async write(placeId: string, input: { path: ScriptPath; source: string; className?: ScriptClassName; expectedVersionId?: VersionId; pendingStudioDeploy?: boolean; uniqueId?: string }): Promise<{ script: ScriptRecord; previous: ScriptRecord }> {
    const normalized = this.normalizeScriptPath(input.path, input.className);
    const scriptPath = normalized.path;
    const place = this.loadPlace(placeId);
    const previous = this.findActiveScript(place, scriptPath, input.uniqueId);
    if (!previous || previous.deleted) throw new AppError(ErrorCode.NOT_FOUND, "Script not found");
    this.checkExpected(previous, input.expectedVersionId);
    this.validateScriptInput(scriptPath, normalized.className ?? input.className ?? previous.className, input.source);
    const script: ScriptRecord = {
      ...previous,
      path: scriptPath,
      uniqueId: input.uniqueId ?? previous.uniqueId,
      className: normalized.className ?? input.className ?? previous.className,
      source: input.source,
      size: input.source.length,
      versionId: this.nextVersionId(),
      updatedAt: new Date().toISOString(),
      deleted: false,
      pendingStudioDeploy: input.pendingStudioDeploy === true || previous.pendingStudioDeploy === true,
    };
    place.set(this.scriptKey(scriptPath, script.uniqueId), script);
    this.savePlace(placeId);
    return { script: { ...script }, previous: { ...previous } };
  }

  async delete(placeId: string, input: { path: ScriptPath; expectedVersionId?: VersionId; uniqueId?: string }): Promise<{ previous: ScriptRecord; deleted: ScriptRecord }> {
    const scriptPath = this.normalizeScriptPath(input.path).path;
    this.validateScriptPath(scriptPath);
    const place = this.loadPlace(placeId);
    const previous = this.findActiveScript(place, scriptPath, input.uniqueId);
    if (!previous || previous.deleted) throw new AppError(ErrorCode.NOT_FOUND, "Script not found");
    this.checkExpected(previous, input.expectedVersionId);
    const deleted: ScriptRecord = {
      ...previous,
      versionId: this.nextVersionId(),
      updatedAt: new Date().toISOString(),
      deleted: true,
    };
    place.set(this.scriptKey(scriptPath, deleted.uniqueId), deleted);
    this.savePlace(placeId);
    return { previous: { ...previous }, deleted: { ...deleted } };
  }

  async rename(placeId: string, input: { fromPath: ScriptPath; toPath: ScriptPath; expectedVersionId?: VersionId; pendingStudioDeploy?: boolean; uniqueId?: string }): Promise<{ previous: ScriptRecord; script: ScriptRecord }> {
    const fromPath = this.normalizeScriptPath(input.fromPath).path;
    const toPath = this.normalizeScriptPath(input.toPath).path;
    this.validateScriptPath(fromPath);
    this.validateScriptPath(toPath);
    const place = this.loadPlace(placeId);
    const previous = this.findActiveScript(place, fromPath, input.uniqueId);
    if (!previous || previous.deleted) throw new AppError(ErrorCode.NOT_FOUND, "Script not found");
    const target = this.findActiveScript(place, toPath, input.uniqueId);
    if (target && target.uniqueId !== previous.uniqueId) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Target script already exists");
    this.checkExpected(previous, input.expectedVersionId);
    const script: ScriptRecord = {
      ...previous,
      path: toPath,
      uniqueId: input.uniqueId ?? previous.uniqueId,
      versionId: this.nextVersionId(),
      updatedAt: new Date().toISOString(),
      deleted: false,
      pendingStudioDeploy: input.pendingStudioDeploy === true || previous.pendingStudioDeploy === true,
    };
    const tombstone: ScriptRecord = { ...previous, versionId: this.nextVersionId(), updatedAt: script.updatedAt, deleted: true };
    place.set(this.scriptKey(fromPath, previous.uniqueId), tombstone);
    place.set(this.scriptKey(toPath, script.uniqueId), script);
    this.savePlace(placeId);
    return { previous: { ...previous }, script: { ...script } };
  }

  async restore(placeId: string, input: { path: ScriptPath; source: string; className: ScriptClassName; pendingStudioDeploy?: boolean; uniqueId?: string }): Promise<{ script: ScriptRecord; previous?: ScriptRecord }> {
    const normalized = this.normalizeScriptPath(input.path, input.className);
    const scriptPath = normalized.path;
    const className = normalized.className ?? input.className;
    this.validateScriptInput(scriptPath, className, input.source);
    const place = this.loadPlace(placeId);
    const previous = this.findScript(place, scriptPath, input.uniqueId);
    const script: ScriptRecord = {
      path: scriptPath,
      uniqueId: input.uniqueId ?? previous?.uniqueId,
      className,
      source: input.source,
      size: input.source.length,
      versionId: this.nextVersionId(),
      updatedAt: new Date().toISOString(),
      deleted: false,
      pendingStudioDeploy: input.pendingStudioDeploy === true || previous?.pendingStudioDeploy === true,
    };
    place.set(this.scriptKey(scriptPath, script.uniqueId), script);
    this.savePlace(placeId);
    return { script: { ...script }, previous: previous ? { ...previous } : undefined };
  }

  async syncSnapshot(placeId: string, input: { scripts: Array<{ path: ScriptPath; className: ScriptClassName; source: string; uniqueId?: string }> }): Promise<{ scripts: ScriptRecord[]; deleted: ScriptRecord[] }> {
    const place = this.loadPlace(placeId);
    const now = new Date().toISOString();
    const activeKeys = new Set<string>();
    const scripts: ScriptRecord[] = [];
    for (const item of input.scripts) {
      const normalized = this.normalizeScriptPath(item.path, item.className);
      const scriptPath = normalized.path;
      const className = normalized.className ?? item.className;
      this.validateScriptInput(scriptPath, className, item.source);
      const key = this.scriptKey(scriptPath, item.uniqueId);
      activeKeys.add(key);
      const existing = this.findScript(place, scriptPath, item.uniqueId);
      const script: ScriptRecord = existing && !existing.deleted && existing.source === item.source && existing.className === className
        ? existing
        : {
            ...(existing ?? {}),
            path: scriptPath,
            uniqueId: item.uniqueId ?? existing?.uniqueId,
            className,
            source: item.source,
            size: item.source.length,
            versionId: this.nextVersionId(),
            updatedAt: now,
            deleted: false,
            pendingStudioDeploy: false,
          };
      script.pendingStudioDeploy = false;
      place.set(this.scriptKey(scriptPath, script.uniqueId), script);
      scripts.push({ ...script });
    }
    const deleted: ScriptRecord[] = [];
    for (const existing of place.values()) {
      if (existing.deleted || this.isProtectedScriptPath(existing.path) || activeKeys.has(this.scriptKey(existing.path, existing.uniqueId))) continue;
      if (existing.pendingStudioDeploy === true || !("pendingStudioDeploy" in existing)) continue;
      const tombstone: ScriptRecord = { ...existing, versionId: this.nextVersionId(), updatedAt: now, deleted: true };
      place.set(this.scriptKey(existing.path, existing.uniqueId), tombstone);
      deleted.push({ ...tombstone });
    }
    this.savePlace(placeId);
    return { scripts, deleted };
  }

  async ackDeploy(placeId: string, refs: ScriptRef[]): Promise<ScriptRef[]> {
    const place = this.loadPlace(placeId);
    const acknowledged: ScriptRef[] = [];
    for (const ref of refs) {
      const scriptPath = this.normalizeScriptPath(ref.path).path;
      this.validateScriptPath(scriptPath);
      const existing = this.findActiveScript(place, scriptPath, ref.uniqueId);
      if (!existing || existing.deleted) continue;
      if (existing.pendingStudioDeploy === true || !("pendingStudioDeploy" in existing)) {
        place.set(this.scriptKey(scriptPath, existing.uniqueId), { ...existing, pendingStudioDeploy: false });
      }
      acknowledged.push({ path: scriptPath, uniqueId: existing.uniqueId });
    }
    if (acknowledged.length > 0) this.savePlace(placeId);
    return acknowledged;
  }

  async cleanupStale(placeId: string, input: { paths: ScriptPath[]; confirm?: boolean; includeLegacy?: boolean; includePending?: boolean }): Promise<{ dryRun: boolean; candidates: ScriptRecord[]; cleaned: ScriptRecord[]; skipped: Array<{ path: ScriptPath; reason: string }> }> {
    const place = this.loadPlace(placeId);
    const dryRun = input.confirm !== true;
    const includeLegacy = input.includeLegacy === true;
    const includePending = input.includePending === true;
    const seen = new Set<ScriptPath>();
    const candidates: ScriptRecord[] = [];
    const cleaned: ScriptRecord[] = [];
    const skipped: Array<{ path: ScriptPath; reason: string }> = [];

    for (const rawPath of input.paths) {
      const scriptPath = this.normalizeScriptPath(rawPath).path;
      if (seen.has(scriptPath)) continue;
      seen.add(scriptPath);
      if (this.isProtectedScriptPath(scriptPath)) {
        skipped.push({ path: scriptPath, reason: "protected_path" });
        continue;
      }
      const existing = this.findScript(place, scriptPath);
      if (!existing) {
        skipped.push({ path: scriptPath, reason: "not_found" });
        continue;
      }
      if (existing.deleted) {
        skipped.push({ path: scriptPath, reason: "already_deleted" });
        continue;
      }
      if (existing.pendingStudioDeploy === true && !includePending) {
        skipped.push({ path: scriptPath, reason: "pending_deploy" });
        continue;
      }
      if (!("pendingStudioDeploy" in existing) && !includeLegacy) {
        skipped.push({ path: scriptPath, reason: "legacy_record" });
        continue;
      }
      candidates.push({ ...existing });
    }

    if (!dryRun && candidates.length > 0) {
      const now = new Date().toISOString();
      for (const candidate of candidates) {
        const tombstone: ScriptRecord = { ...candidate, versionId: this.nextVersionId(), updatedAt: now, deleted: true, pendingStudioDeploy: false };
        place.set(this.scriptKey(candidate.path, candidate.uniqueId), tombstone);
        cleaned.push({ ...tombstone });
      }
      this.savePlace(placeId);
    }

    return { dryRun, candidates, cleaned, skipped };
  }

  private findScript(place: Map<string, ScriptRecord>, scriptPath: ScriptPath, uniqueId?: string): ScriptRecord | undefined {
    if (uniqueId) return place.get(this.scriptKey(scriptPath, uniqueId)) ?? [...place.values()].find((script) => script.uniqueId === uniqueId);
    const matches = [...place.values()].filter((script) => script.path === scriptPath);
    if (matches.length > 1) {
      const active = matches.filter((script) => !script.deleted);
      if (active.length > 1) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Ambiguous script path; uniqueId required");
      return active[0] ?? matches.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    }
    return matches[0];
  }

  private findActiveScript(place: Map<string, ScriptRecord>, scriptPath: ScriptPath, uniqueId?: string): ScriptRecord | undefined {
    const script = this.findScript(place, scriptPath, uniqueId);
    return script && !script.deleted ? script : undefined;
  }

  private scriptKey(scriptPath: ScriptPath, uniqueId?: string): string {
    return uniqueId ? `uid:${uniqueId}` : `path:${scriptPath}`;
  }

  private loadPlace(placeId: string): Map<ScriptPath, ScriptRecord> {
    const cached = this.places.get(placeId);
    if (cached) return cached;
    const dir = this.getPlaceDirectory(placeId);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "scripts.json");
    const place = new Map<ScriptPath, ScriptRecord>();
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as PlaceRegistryFile;
      for (const script of parsed.scripts || []) {
        const normalized = this.normalizeScriptRecord(script);
        const key = this.scriptKey(normalized.path, normalized.uniqueId);
        const existing = place.get(key);
        if (!existing || Date.parse(normalized.updatedAt) >= Date.parse(existing.updatedAt)) place.set(key, normalized);
      }
    }
    this.places.set(placeId, place);
    return place;
  }

  private savePlace(placeId: string): void {
    const dir = this.getPlaceDirectory(placeId);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "scripts.json");
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    const scripts = [...this.loadPlace(placeId).values()].sort((a, b) => a.path.localeCompare(b.path));
    writeFileSync(tmp, JSON.stringify({ scripts, updatedAt: new Date().toISOString() } satisfies PlaceRegistryFile, null, 2), "utf8");
    renameSync(tmp, file);
  }

  private normalizeScriptRecord(script: ScriptRecord): ScriptRecord {
    const normalized = this.normalizeScriptPath(script.path, script.className);
    return { ...script, path: normalized.path, className: normalized.className ?? script.className };
  }

  private normalizeScriptPath(scriptPath: ScriptPath, className?: ScriptClassName): { path: ScriptPath; className?: ScriptClassName } {
    let normalizedPath = String(scriptPath).replace(/\\/g, "/");
    let inferredClassName = className;
    const normalizeLeaf = (leaf: string): string => {
      if (/\.server\.lua(u)?$/i.test(leaf)) {
        inferredClassName ??= "Script";
        return leaf.replace(/\.server\.lua(u)?$/i, "");
      }
      if (/\.client\.lua(u)?$/i.test(leaf)) {
        inferredClassName ??= "LocalScript";
        return leaf.replace(/\.client\.lua(u)?$/i, "");
      }
      if (/\.lua(u)?$/i.test(leaf)) {
        inferredClassName ??= "ModuleScript";
        return leaf.replace(/\.lua(u)?$/i, "");
      }
      return leaf;
    };
    if (normalizedPath.includes("/")) {
      const parts = normalizedPath.split("/").filter(Boolean);
      if (parts.length > 0) parts[parts.length - 1] = normalizeLeaf(parts[parts.length - 1]);
      normalizedPath = parts.join(".");
    } else {
      normalizedPath = normalizeLeaf(normalizedPath);
    }
    return { path: normalizedPath, className: inferredClassName };
  }

  private isProtectedScriptPath(scriptPath: string): boolean {
    if (!scriptPath || scriptPath.includes("..") || scriptPath.includes("//")) return true;
    if (!this.isAllowedRoot(scriptPath)) return true;
    if (scriptPath === "Workspace" || scriptPath.startsWith("Workspace.")) return true;
    if (scriptPath === "Players" || scriptPath.startsWith("Players.")) return true;
    const lowerPath = scriptPath.toLowerCase();
    const leaf = lowerPath.split(".").pop() ?? lowerPath;
    if (/^roagent\d*$/.test(leaf) || /^roagentupdate\d*$/.test(leaf) || /^studiolink/.test(leaf)) return true;
    if (lowerPath.includes("playermodule") || lowerPath.includes("camerascript") || lowerPath.includes("controlscript")) return true;
    if (leaf === "animate") return true;
    return false;
  }

  private isAllowedRoot(scriptPath: string): boolean {
    const root = scriptPath.split(".", 1)[0];
    return new Set([
      "ServerScriptService",
      "ServerStorage",
      "ReplicatedStorage",
      "ReplicatedFirst",
      "StarterGui",
      "StarterPack",
      "StarterPlayer",
      "StarterPlayerScripts",
      "StarterCharacterScripts",
      "Lighting",
      "Teams",
      "SoundService",
      "Chat",
    ]).has(root);
  }

  private nextVersionId(): VersionId {
    return `${Date.now()}-${randomUUID()}`;
  }

  private checkExpected(script: ScriptRecord, expectedVersionId?: VersionId): void {
    if (expectedVersionId && script.versionId !== expectedVersionId) {
      throw new AppError(ErrorCode.GIT_CONFLICT, "Script version conflict", { retryable: false });
    }
  }

  private validateScriptPath(scriptPath: ScriptPath): void {
    if (!scriptPath || typeof scriptPath !== "string") throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid script path");
    if (this.isProtectedScriptPath(scriptPath)) throw new AppError(ErrorCode.PERMISSION_DENIED, "Protected script path");
  }

  private validateScriptInput(scriptPath: ScriptPath, className: ScriptClassName, source: string): void {
    this.validateScriptPath(scriptPath);
    if (!["Script", "LocalScript", "ModuleScript"].includes(className)) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid script className");
    if (typeof source !== "string") throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid script source");
  }
}
