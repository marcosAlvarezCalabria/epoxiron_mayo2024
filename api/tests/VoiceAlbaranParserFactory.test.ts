import { describe, expect, it } from "vitest";
import { OllamaVoiceAlbaranParser } from "../src/infrastructure/services/OllamaVoiceAlbaranParser.js";
import { OpenAiCompatibleVoiceAlbaranParser } from "../src/infrastructure/services/OpenAiCompatibleVoiceAlbaranParser.js";
import { createVoiceAlbaranParser } from "../src/infrastructure/services/VoiceAlbaranParserFactory.js";

describe("createVoiceAlbaranParser", () => {
  it("creates an ollama parser", () => {
    const parser = createVoiceAlbaranParser({
      apiKey: "",
      baseUrl: "http://127.0.0.1:11434",
      model: "llama3.1:8b",
      provider: "ollama",
      timeoutMs: 1000
    });

    expect(parser).toBeInstanceOf(OllamaVoiceAlbaranParser);
  });

  it("creates an openai-compatible parser", () => {
    const parser = createVoiceAlbaranParser({
      apiKey: "key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      provider: "openai-compatible",
      timeoutMs: 1000
    });

    expect(parser).toBeInstanceOf(OpenAiCompatibleVoiceAlbaranParser);
  });
});
