import type { Handler } from "../types.ts";
import { PROTOCOL_VERSION } from "../../../shared/protocol.ts";

export const daemonHandlers: Record<string, Handler> = {
  "daemon:health"(message, context) {
    return {
      ok: true,
      daemonVersion: "3.0.0",
      protocolVersion: PROTOCOL_VERSION,
      uptimeSeconds: process.uptime(),
      startedAt: context.config.startedAt,
      activeConnections: context.connections.size,
      activePlaces: context.placeStore.listActivePlaces(),
      storage: { ok: true, path: context.config.dataDirectory },
      git: { available: true },
      agent: context.agentService.status(message.placeId),
      license: context.licenseService.status(),
    };
  },
};
