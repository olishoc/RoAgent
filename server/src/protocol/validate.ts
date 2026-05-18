import type { RawData } from "ws";
import { PROTOCOL_VERSION, type ClientToServerMessage } from "../../../shared/protocol.ts";
import { invalidPayload } from "./respond.ts";

export function parseEnvelope(raw: RawData | string | Buffer): ClientToServerMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString());
  } catch {
    throw invalidPayload("Message must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object") throw invalidPayload("Message must be an object");
  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== PROTOCOL_VERSION) throw invalidPayload("Unsupported protocol version");
  if (typeof candidate.type !== "string" || candidate.type.length === 0) throw invalidPayload("Missing message type");
  if (typeof candidate.requestId !== "string" || candidate.requestId.length === 0) throw invalidPayload("Missing requestId");
  if (typeof candidate.placeId !== "string" || candidate.placeId.length === 0) throw invalidPayload("Missing placeId");
  if (Array.isArray(candidate.payload) && candidate.payload.length === 0) candidate.payload = {};
  if (!candidate.payload || typeof candidate.payload !== "object" || Array.isArray(candidate.payload)) throw invalidPayload("Missing payload object");
  return candidate as unknown as ClientToServerMessage;
}
