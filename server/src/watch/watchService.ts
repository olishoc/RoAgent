import { existsSync, mkdirSync, watch, type FSWatcher } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type { AppLogger } from "../logger.ts";
import type { Config } from "../config.ts";
import { sendEnvelope } from "../protocol/respond.ts";
import type { HistoryVersion, PlaceId, ScriptPath, ScriptRecord, WatchEvent } from "../../../shared/protocol.ts";

interface Subscription {
  id: string;
  placeId: PlaceId;
  ws: WebSocket;
  includeSource: boolean;
}

export class WatchService {
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly watchers = new Map<PlaceId, FSWatcher>();

  constructor(private readonly config: Config, private readonly logger: AppLogger) {}

  subscribe(placeId: PlaceId, ws: WebSocket, includeSource = false): string {
    const id = randomUUID();
    this.subscriptions.set(id, { id, placeId, ws, includeSource });
    this.ensureWatcher(placeId);
    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;
    this.subscriptions.delete(subscriptionId);
    this.stopWatcherIfUnused(subscription.placeId);
    return true;
  }

  removeSocket(ws: WebSocket): void {
    const affected = new Set<PlaceId>();
    for (const [id, subscription] of this.subscriptions) {
      if (subscription.ws === ws) {
        affected.add(subscription.placeId);
        this.subscriptions.delete(id);
      }
    }
    for (const placeId of affected) this.stopWatcherIfUnused(placeId);
  }

  broadcast(placeId: PlaceId, event: Omit<WatchEvent, "eventId" | "timestamp"> & { eventId?: string; timestamp?: string }): void {
    const full: WatchEvent = {
      eventId: event.eventId ?? randomUUID(),
      timestamp: event.timestamp ?? new Date().toISOString(),
      ...event,
    };
    for (const subscription of this.subscriptions.values()) {
      if (subscription.placeId !== placeId) continue;
      if (subscription.ws.readyState !== WebSocket.OPEN) continue;
      const payload = subscription.includeSource ? full : this.withoutSource(full);
      sendEnvelope(subscription.ws, "watch:event", randomUUID(), placeId, payload);
    }
  }

  private ensureWatcher(placeId: PlaceId): void {
    if (this.watchers.has(placeId)) return;
    const dir = this.placeDirectory(placeId);
    try {
      mkdirSync(dir, { recursive: true });
      const watcher = watch(dir, { persistent: false }, (_eventType, filename) => {
        if (!filename) return;
        if (!existsSync(dir)) {
          this.logger.warn({ event: "watch-dir-missing", placeId }, "Watched directory missing");
          this.closeWatcher(placeId);
          return;
        }
        this.broadcast(placeId, {
          kind: "updated",
          path: filename.toString() as ScriptPath,
          origin: "file-watch",
        });
      });
      watcher.on("error", (error) => {
        this.logger.warn({ event: "watch-error", placeId }, "Watcher error");
        this.logger.error(this.logger.sanitizeError(error), "Watcher stack");
        this.closeWatcher(placeId);
      });
      this.watchers.set(placeId, watcher);
    } catch (error) {
      this.logger.warn({ event: "watch-start-failed", placeId }, "Failed to start watcher");
      this.logger.error(this.logger.sanitizeError(error), "Watcher start stack");
    }
  }

  private stopWatcherIfUnused(placeId: PlaceId): void {
    const stillUsed = [...this.subscriptions.values()].some((subscription) => subscription.placeId === placeId);
    if (!stillUsed) this.closeWatcher(placeId);
  }

  private closeWatcher(placeId: PlaceId): void {
    const watcher = this.watchers.get(placeId);
    if (watcher) watcher.close();
    this.watchers.delete(placeId);
  }

  private placeDirectory(placeId: PlaceId): string {
    return path.join(this.config.dataDirectory, "places", encodeURIComponent(placeId));
  }

  private withoutSource(event: WatchEvent): WatchEvent {
    const clone: WatchEvent = { ...event };
    if (clone.script) clone.script = { ...clone.script, source: "" } as ScriptRecord;
    if (clone.historyVersion) clone.historyVersion = { ...clone.historyVersion, source: undefined } as HistoryVersion;
    return clone;
  }
}
