import { describe, expect, it } from "vitest";
import { buildAiLaunchEnvironment } from "../server/src/services/apiKeyConfig.ts";

describe("StudioLink AI launch environment", () => {
  it("passes keychain credentials to RoAgent using StudioLink environment variables", () => {
    expect(buildAiLaunchEnvironment({
      aiProvider: "openai",
      aiApiKey: "<keychain>",
      aiModel: "gpt-4.1",
      aiMaxTokens: 8000,
    }, "secret-key")).toEqual({
      STUDIOLINK_AI_PROVIDER: "openai",
      STUDIOLINK_AI_MODEL: "gpt-4.1",
      STUDIOLINK_AI_API_KEY: "secret-key",
    });
  });

  it("does not create a partial credential environment", () => {
    expect(buildAiLaunchEnvironment({ aiProvider: "openai", aiModel: "gpt-4.1" }, null)).toEqual({});
    expect(buildAiLaunchEnvironment({ aiProvider: "unsupported" as never, aiModel: "model" }, "secret-key")).toEqual({});
  });
});
