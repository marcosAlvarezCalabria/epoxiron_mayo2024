import type { VoiceAlbaranParser } from "../../domain/ports/VoiceAlbaranParser.js";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import { OllamaVoiceAlbaranParser } from "./OllamaVoiceAlbaranParser.js";
import { OpenAiCompatibleVoiceAlbaranParser } from "./OpenAiCompatibleVoiceAlbaranParser.js";

export type VoiceParserProvider = "ollama" | "openai-compatible";

interface VoiceParserConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  provider: VoiceParserProvider;
  timeoutMs: number;
}

export const createVoiceAlbaranParser = (config: VoiceParserConfig): VoiceAlbaranParser => {
  if (config.provider === "ollama") {
    return new OllamaVoiceAlbaranParser({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      timeoutMs: config.timeoutMs
    });
  }

  if (config.provider === "openai-compatible") {
    return new OpenAiCompatibleVoiceAlbaranParser({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      timeoutMs: config.timeoutMs
    });
  }

  throw new DomainException("Proveedor de voz no soportado", 500);
};
