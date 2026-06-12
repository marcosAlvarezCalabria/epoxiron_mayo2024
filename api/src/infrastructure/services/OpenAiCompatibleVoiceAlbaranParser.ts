import { DomainException } from "../../domain/exceptions/DomainException.js";
import type {
  ParsedVoiceAlbaran,
  VoiceAlbaranParser,
  VoiceAlbaranParserContext
} from "../../domain/ports/VoiceAlbaranParser.js";
import { normalizeParsedVoiceAlbaran } from "../../schemas/voiceSchemas.js";
import { buildVoiceAlbaranUserPrompt, voiceAlbaranSystemPrompt } from "./voicePrompt.js";

interface OpenAiCompatibleVoiceAlbaranParserOptions {
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface OpenAiCompatibleChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
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

export class OpenAiCompatibleVoiceAlbaranParser implements VoiceAlbaranParser {
  public constructor(private readonly options: OpenAiCompatibleVoiceAlbaranParserOptions) {}

  public async parseTranscript(
    transcript: string,
    context?: VoiceAlbaranParserContext
  ): Promise<ParsedVoiceAlbaran> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: this.options.model,
          temperature: 0,
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "system",
              content: voiceAlbaranSystemPrompt
            },
            {
              role: "user",
              content: buildVoiceAlbaranUserPrompt(
                transcript,
                context?.customerNames,
                context?.specialPieceNames
              )
            }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new DomainException(`Servicio de voz no disponible (${response.status})`, 502);
      }

      const payload = (await response.json()) as OpenAiCompatibleChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new DomainException("No se pudo interpretar el texto", 422);
      }

      return normalizeParsedVoiceAlbaran(JSON.parse(extractJsonText(content)) as unknown);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        throw new DomainException("No se pudo interpretar el texto", 422);
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new DomainException("Servicio de voz no disponible", 502);
      }

      throw new DomainException("Servicio de voz no disponible", 502);
    } finally {
      clearTimeout(timeout);
    }
  }
}
