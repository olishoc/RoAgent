import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { AppError } from "../errors.ts";
import { ErrorCode } from "../../../shared/protocol.ts";

const SERVICE = "StudioLink";
const ACCOUNT = "aiApiKey";

export interface StudioLinkAiConfig {
  aiProvider: "anthropic" | "openai" | "openrouter";
  aiApiKey: "<keychain>";
  aiModel: string;
  aiMaxTokens: number;
}

export function configPath(): string {
  if (process.platform === "win32") return path.join(process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"), "StudioLink", "config.json");
  return path.join(homedir(), "Library", "Application Support", "StudioLink", "config.json");
}

export async function saveApiKeyConfig(input: { provider: string; apiKey: string; model: string; aiMaxTokens?: number }): Promise<StudioLinkAiConfig> {
  if (!isProvider(input.provider)) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Unsupported AI provider");
  if (!input.apiKey || input.apiKey.length < 8) throw new AppError(ErrorCode.INVALID_PAYLOAD, "API key is too short");
  if (!input.model) throw new AppError(ErrorCode.INVALID_PAYLOAD, "Model is required");
  const keytar = await loadKeytar();
  await keytar.setPassword(SERVICE, ACCOUNT, input.apiKey);
  const file = configPath();
  mkdirSync(path.dirname(file), { recursive: true });
  const existing = readExistingConfig(file);
  const config: StudioLinkAiConfig = {
    ...existing,
    aiProvider: input.provider,
    aiApiKey: "<keychain>",
    aiModel: input.model,
    aiMaxTokens: input.aiMaxTokens ?? existing.aiMaxTokens ?? 8000,
  };
  writeFileSync(file, JSON.stringify(config, null, 2), { encoding: "utf8", mode: 0o600 });
  return config;
}

export async function getApiKey(): Promise<string | null> {
  const keytar = await loadKeytar();
  return keytar.getPassword(SERVICE, ACCOUNT);
}

async function loadKeytar(): Promise<typeof import("keytar")> {
  return import("keytar");
}

function readExistingConfig(file: string): Partial<StudioLinkAiConfig> {
  if (!existsSync(file)) return {};
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<StudioLinkAiConfig>;
  return { ...parsed, aiApiKey: "<keychain>" };
}

function isProvider(value: string): value is StudioLinkAiConfig["aiProvider"] {
  return value === "anthropic" || value === "openai" || value === "openrouter";
}
