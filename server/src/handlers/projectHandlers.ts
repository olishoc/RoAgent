import { AppError } from "../errors.ts";
import type { Handler } from "../types.ts";
import { ErrorCode, GLOBAL_PLACE_ID, type ClientToServerMessage, type PlaceId } from "../../../shared/protocol.ts";
import { scriptHandlers } from "./scriptHandlers.ts";

function payload(message: ClientToServerMessage): Record<string, unknown> {
  return message.payload as Record<string, unknown>;
}

function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new AppError(ErrorCode.INVALID_PAYLOAD, `Invalid ${key}`);
  return value;
}

function projectPlaceId(message: ClientToServerMessage, p: Record<string, unknown>): PlaceId {
  const placeId = optionalString(p, "placeId") ?? message.placeId;
  if (!placeId || placeId === GLOBAL_PLACE_ID) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Missing project placeId");
  return placeId;
}

function rewritePlace(message: ClientToServerMessage, placeId: PlaceId): ClientToServerMessage {
  return { ...message, placeId } as ClientToServerMessage;
}

export const projectHandlers: Record<string, Handler> = {
  "project:list"(message, context) {
    const p = payload(message);
    const projects = context.placeStore.listProjects({ includeInactive: p.includeInactive === true });
    return { projects, count: projects.length };
  },

  async "project:scripts"(message, context) {
    const p = payload(message);
    const placeId = projectPlaceId(message, p);
    const scripts = await context.placeStore.list(placeId, { includeSource: p.includeSource === true, includeDeleted: p.includeDeleted === true });
    return { project: context.placeStore.getProject(placeId), scripts, count: scripts.length, totalBytes: scripts.reduce((sum, script) => sum + script.size, 0) };
  },

  async "project:read"(message, context, ws) {
    const p = payload(message);
    const placeId = projectPlaceId(message, p);
    const read = await scriptHandlers["script:read"](rewritePlace(message, placeId), context, ws) as { script: object };
    return { project: context.placeStore.getProject(placeId), script: read.script };
  },

  async "project:write"(message, context, ws) {
    const p = payload(message);
    const placeId = projectPlaceId(message, p);
    const write = await scriptHandlers["script:write"](rewritePlace(message, placeId), context, ws) as { script: object; historyVersion: object };
    return { project: context.placeStore.getProject(placeId), script: write.script, historyVersion: write.historyVersion };
  },
};
