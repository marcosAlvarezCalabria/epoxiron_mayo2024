import { Ollama } from "ollama";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type {
  ParsedVoiceAlbaran,
  VoiceAlbaranParser,
  VoiceAlbaranParserContext
} from "../../domain/ports/VoiceAlbaranParser.js";
import { normalizeParsedVoiceAlbaran } from "../../schemas/voiceSchemas.js";
import { buildVoiceAlbaranUserPrompt, voiceAlbaranSystemPrompt } from "./voicePrompt.js";

interface OllamaVoiceAlbaranParserOptions {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  model: string;
  timeoutMs: number;
}

const extractJsonText = (content: string): string => {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new DomainException("No se pudo interpretar el texto", 422);
  }

  return jsonMatch[0];
};

export class OllamaVoiceAlbaranParser implements VoiceAlbaranParser {
  private readonly client: Ollama;

  public constructor(private readonly options: OllamaVoiceAlbaranParserOptions) {
    this.client = new Ollama({
      fetch: this.options.fetchImpl,
      host: this.options.baseUrl,
      headers: this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : undefined
    });
  }

  public async parseTranscript(
    transcript: string,
    context?: VoiceAlbaranParserContext
  ): Promise<ParsedVoiceAlbaran> {
    try {
      const response = await Promise.race([
        this.client.chat({
          model: this.options.model,
          stream: false,
          format: "json",
          think: false,
          options: {
            temperature: 0
          },
          messages: [
            {
              role: "system",
              content: voiceAlbaranSystemPrompt
            },
            {
              role: "user",
              content: buildVoiceAlbaranUserPrompt(transcript, context?.customerNames)
            }
          ]
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new DomainException("Servicio de voz no disponible (timeout)", 502)), this.options.timeoutMs);
        })
      ]);

      const content = response.message?.content;
      if (!content) {
        throw new DomainException("No se pudo interpretar el texto", 422);
      }

      try {
        const parsedJson = JSON.parse(extractJsonText(content)) as unknown;
        return normalizeParsedVoiceAlbaran(parsedJson);
      } catch (error) {
        if (error instanceof DomainException) {
          throw new DomainException(
            `No se pudo interpretar el texto. Respuesta del modelo: ${content.slice(0, 600)}`,
            422
          );
        }

        if (error instanceof SyntaxError) {
          throw new DomainException(
            `No se pudo interpretar el texto. Respuesta del modelo: ${content.slice(0, 600)}`,
            422
          );
        }

        throw error;
      }
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        throw new DomainException("No se pudo interpretar el texto", 422);
      }

      if (
        error &&
        typeof error === "object" &&
        "status_code" in error &&
        typeof error.status_code === "number"
      ) {
        throw new DomainException(`Servicio de voz no disponible (${error.status_code})`, 502);
      }

      if (error instanceof Error) {
        throw new DomainException(error.message || "Servicio de voz no disponible", 502);
      }

      throw new DomainException("Servicio de voz no disponible", 502);
    }
  }
}
