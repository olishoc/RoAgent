import type { Handler } from "../types.ts";

export const agentHandlers: Record<string, Handler> = {
  "agent:launch"(message, context) {
    return context.agentService.launch(message.placeId, context);
  },

  "agent:kill"(message, context) {
    return context.agentService.kill(message.placeId);
  },

  "agent:status"(message, context) {
    return context.agentService.status(message.placeId);
  },

  "agent:recentActions"(message, context) {
    return { actions: context.agentService.recentActions(message.placeId) };
  },
};
