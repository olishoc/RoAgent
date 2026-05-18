import type { Handler } from "../types.ts";
import { PROTOCOL_VERSION } from "../../../shared/protocol.ts";
import { BUILD_INFO } from "../buildInfo.ts";
import { updateStatusSnapshot } from "../services/updateService.ts";

export const daemonHandlers: Record<string, Handler> = {
  "daemon:health"(message, context) {
    return {
      ok: true,
      daemonVersion: "3.0.0",
      releaseTag: BUILD_INFO.releaseTag,
      commitSha: BUILD_INFO.commitSha,
      buildTime: BUILD_INFO.buildTime,
      protocolVersion: PROTOCOL_VERSION,
      update: updateStatusSnapshot(),
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
