import { v2 } from "@google-cloud/speech";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { VoiceTranscriber, VoiceTranscriptionInput } from "../../domain/ports/VoiceTranscriber.js";

interface GoogleChirpVoiceTranscriberOptions {
  projectId: string;
  location: string;
  model: string;
  language?: string;
  timeoutMs: number;
}

const normalizeLanguage = (language?: string): string => {
  const normalized = language?.trim().toLowerCase();
  return !normalized || normalized === "es" ? "es-ES" : (language?.trim() ?? "es-ES");
};

export class GoogleChirpVoiceTranscriber implements VoiceTranscriber {
  private readonly client: InstanceType<typeof v2.SpeechClient>;

  public constructor(private readonly options: GoogleChirpVoiceTranscriberOptions) {
    this.client = new v2.SpeechClient({
      apiEndpoint: `${options.location.trim()}-speech.googleapis.com`
    });
  }

  public async transcribe(input: VoiceTranscriptionInput): Promise<string> {
    try {
      const [response] = await this.client.recognize({
        recognizer: `projects/${this.options.projectId}/locations/${this.options.location}/recognizers/_`,
        config: {
          autoDecodingConfig: {},
          languageCodes: [normalizeLanguage(this.options.language)],
          model: this.options.model,
          features: { enableAutomaticPunctuation: true }
        },
        content: input.buffer
      }, { timeout: this.options.timeoutMs });

      const transcript = response.results
        ?.map((result) => result.alternatives?.[0]?.transcript?.trim() ?? "")
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!transcript) throw new DomainException("No se pudo transcribir el audio", 422);
      return transcript;
    } catch (error: unknown) {
      if (error instanceof DomainException) throw error;
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code === "4" || code === "DEADLINE_EXCEEDED") {
        throw new DomainException("Servicio de voz no disponible (timeout)", 502);
      }
      throw new DomainException("Servicio Google Chirp 3 no disponible", 502);
    }
  }
}
