import { Ollama } from "ollama";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { VoiceTranscriber, VoiceTranscriptionInput } from "../../domain/ports/VoiceTranscriber.js";

interface OllamaVoiceTranscriberOptions {
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface MessageVariant {
  label: string;
  payload: {
    role: "user";
    content: string;
    audios?: string[];
    audio?: string[];
    files?: string[];
  };
}

const transcriptionSystemPrompt = [
  "You transcribe Spanish workshop dictation for powder coating delivery notes.",
  "Return only the transcript text in Spanish. No JSON. No explanations. No markdown.",
  "Do not summarize, interpret, or clean the content beyond transcription.",
  "Preserve technical terms, RAL codes, measurements, quantities, and special-piece names as literally as possible.",
  "Prefer digits for colors and measurements when the audio is clear: 9005, 7016, 800x500, 13.7m.",
  "Common workshop vocabulary includes: RAL, gofrado, mate, texturado, imprimacion, tubo, chapa, bastidor, armario, gondola, cajon, escalerillas, canalon, conjunto, pie, mueble.",
  "If the speaker says compound special-piece names, keep the full compound name together.",
  "If unsure, still transcribe the raw spoken words instead of inventing or omitting content."
].join(" ");

const baseUserPrompt = [
  "Transcribe this workshop audio exactly.",
  "Keep piece names together.",
  "Keep RAL colors as 4-digit codes when possible.",
  "Keep dimensions like 800x500 and joined measures like 1050x1200 + 500x400.",
  "Return only transcript text."
].join(" ");

const looksLikeMissingAudioReply = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("provide the audio") ||
    normalized.includes("provide the spoken text") ||
    normalized.includes("would like me to transcribe") ||
    normalized.includes("please provide the audio file")
  );
};

export class OllamaVoiceTranscriber implements VoiceTranscriber {
  private readonly client: Ollama;

  public constructor(private readonly options: OllamaVoiceTranscriberOptions) {
    this.client = new Ollama({
      host: this.options.baseUrl,
      headers: this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : undefined
    });
  }

  public async transcribe(input: VoiceTranscriptionInput): Promise<string> {
    try {
      const audioBase64 = input.buffer.toString("base64");
      const audioDataUrl = `data:${input.mimeType || "audio/webm"};base64,${audioBase64}`;
      const diagnostics: string[] = [];
      const messageVariants: MessageVariant[] = [
        {
          label: "audios",
          payload: {
            role: "user",
            content: baseUserPrompt,
            audios: [audioBase64]
          }
        },
        {
          label: "audio",
          payload: {
            role: "user",
            content: baseUserPrompt,
            audio: [audioBase64]
          }
        },
        {
          label: "files",
          payload: {
            role: "user",
            content: baseUserPrompt,
            files: [audioDataUrl]
          }
        }
      ];

      for (const variant of messageVariants) {
        let response;
        try {
          response = await Promise.race([
            this.client.chat({
              model: this.options.model,
              stream: false,
              think: false,
              messages: [
                {
                  role: "system",
                  content: transcriptionSystemPrompt
                },
                variant.payload
              ]
            }),
            new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new DomainException("Servicio de voz no disponible (timeout)", 502)),
                this.options.timeoutMs
              );
            })
          ]);
        } catch (error) {
          if (
            error &&
            typeof error === "object" &&
            "status_code" in error &&
            typeof error.status_code === "number" &&
            error.status_code === 400
          ) {
            diagnostics.push(
              `${variant.label}:400${
                "message" in error && typeof error.message === "string" ? `:${error.message}` : ""
              }`
            );
            continue;
          }

          diagnostics.push(
            `${variant.label}:error${
              error instanceof Error && error.message ? `:${error.message}` : ""
            }`
          );
          throw error;
        }

        const transcript = response.message?.content?.trim();
        if (!transcript || looksLikeMissingAudioReply(transcript)) {
          diagnostics.push(`${variant.label}:empty-or-missing-audio-reply`);
          continue;
        }

        return transcript;
      }

      throw new DomainException(
        `No se pudo transcribir el audio. Diagnostico Ollama: ${diagnostics.join(" | ")}`.slice(0, 1500),
        422
      );
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }

      if (
        error &&
        typeof error === "object" &&
        "status_code" in error &&
        typeof error.status_code === "number"
      ) {
        const upstreamMessage =
          "message" in error && typeof error.message === "string" && error.message.trim()
            ? ` ${error.message.trim()}`
            : "";
        throw new DomainException(
          `Servicio de voz no disponible (${error.status_code})${upstreamMessage} [transcriber=ollama model=${this.options.model} baseUrl=${this.options.baseUrl}]`,
          502
        );
      }

      throw new DomainException("Servicio de voz no disponible", 502);
    }
  }
}
