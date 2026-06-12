import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { VoiceTranscriber, VoiceTranscriptionInput } from "../../domain/ports/VoiceTranscriber.js";

interface OpenAiVoiceTranscriberOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt?: string;
  language?: string;
  timeoutMs: number;
}

interface OpenAiTranscriptionResponse {
  text?: string;
}

export class OpenAiVoiceTranscriber implements VoiceTranscriber {
  public constructor(private readonly options: OpenAiVoiceTranscriberOptions) {}

  public async transcribe(input: VoiceTranscriptionInput): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const formData = new FormData();
      formData.set("model", this.options.model);
      formData.set("language", this.options.language ?? "es");
      if (this.options.prompt?.trim()) {
        formData.set("prompt", this.options.prompt.trim());
      }

      const file = new Blob([new Uint8Array(input.buffer)], {
        type: input.mimeType || "application/octet-stream"
      });
      formData.set("file", file, input.fileName);

      const response = await fetch(`${this.options.baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`
        },
        body: formData,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new DomainException(`Servicio de voz no disponible (${response.status})`, 502);
      }

      const payload = (await response.json()) as OpenAiTranscriptionResponse;
      const transcript = payload.text?.trim();
      if (!transcript) {
        throw new DomainException("No se pudo transcribir el audio", 422);
      }

      return transcript;
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new DomainException("Servicio de voz no disponible (timeout)", 502);
      }

      throw new DomainException("Servicio de voz no disponible", 502);
    } finally {
      clearTimeout(timeout);
    }
  }
}
