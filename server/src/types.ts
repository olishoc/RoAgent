import type WebSocket from "ws";
import type { Config } from "./config.ts";
import type { AppLogger } from "./logger.ts";
import type { PlaceStore } from "./state/placeStore.ts";
import type { HistoryStore } from "./history/historyStore.ts";
import type { WatchService } from "./watch/watchService.ts";
import type { AgentService } from "./services/agentService.ts";
import type { LicenseService } from "./services/licenseService.ts";
import type { ClientToServerMessage } from "../../shared/protocol.ts";

export interface HandlerContext {
  config: Config;
  logger: AppLogger;
  placeStore: PlaceStore;
  historyStore: HistoryStore;
  watchService: WatchService;
  agentService: AgentService;
  licenseService: LicenseService;
  connections: Set<WebSocket>;
}

export type Handler = (message: ClientToServerMessage, context: HandlerContext, ws: WebSocket) => Promise<object> | object;
