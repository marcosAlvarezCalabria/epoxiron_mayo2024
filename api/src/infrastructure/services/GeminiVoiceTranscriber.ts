import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { VoiceTranscriber, VoiceTranscriptionInput } from "../../domain/ports/VoiceTranscriber.js";

interface GeminiVoiceTranscriberOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  language?: string;
  timeoutMs: number;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface GeminiInlineDataPart {
  inline_data: {
    mime_type: string;
    data: string;
  };
}

interface GeminiFileDataPart {
  file_data: {
    mime_type: string;
    file_uri: string;
  };
}

interface GeminiTextPart {
  text: string;
}

interface GeminiFileUploadResponse {
  file?: {
    uri?: string;
    mimeType?: string;
    mime_type?: string;
  };
  error?: {
    message?: string;
  };
}

interface GeminiEndpoints {
  generateBaseUrl: string;
  uploadBaseUrl: string;
}

const INLINE_AUDIO_MAX_BYTES = 14 * 1024 * 1024;

const transcriptionPrompt = [
  "Transcribe this Spanish workshop audio exactly.",
  "Return only the transcript text in Spanish.",
  "Do not summarize, explain, translate, or add markdown.",
  "Preserve piece names, special-piece names, colors, RAL codes, measurements, quantities, and pricing words as literally as possible.",
  "Prefer digits when the audio is clear, for example: 9005, 7016, 800x500, 13.7m, 5 unidades.",
  "Common workshop vocabulary includes: RAL, gofrado, mate, texturado, imprimacion, tubo, chapa, bastidor, armario, gondola, cajon, escalerillas, canalon, conjunto, pie, mueble.",
  "If the speaker says a compound special-piece name, keep the full compound name together.",
  "Primary language: ${language}."
].join(" ");

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

export const resolveGeminiEndpoints = (baseUrl: string): GeminiEndpoints => {
  const trimmed = trimTrailingSlashes(baseUrl);
  const normalized = trimmed.includes("/upload/")
    ? trimmed.replace("/upload/", "/")
    : trimmed;

  if (normalized.endsWith("/v1beta") || normalized.endsWith("/v1")) {
    const uploadBaseUrl = normalized.replace(/\/(v1beta|v1)$/, "/upload/$1");
    return {
      generateBaseUrl: normalized,
      uploadBaseUrl
    };
  }

  return {
    generateBaseUrl: `${normalized}/v1beta`,
    uploadBaseUrl: `${normalized}/upload/v1beta`
  };
};

export const normalizeGeminiMimeType = (mimeType: string): string => {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return "audio/webm";
  }

  if (normalized === "audio/mpeg") {
    return "audio/mp3";
  }

  return normalized;
};

export const extractGeminiText = (payload: GeminiGenerateContentResponse): string | null => {
  const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  const text = parts
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || null;
};

const readGeminiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message?.trim() ?? "";
  } catch {
    return "";
  }
};

export const shouldUseGeminiFilesApi = (bufferSize: number): boolean => bufferSize > INLINE_AUDIO_MAX_BYTES;

export class GeminiVoiceTranscriber implements VoiceTranscriber {
  private readonly endpoints: GeminiEndpoints;

  public constructor(private readonly options: GeminiVoiceTranscriberOptions) {
    this.endpoints = resolveGeminiEndpoints(this.options.baseUrl);
  }

  public async transcribe(input: VoiceTranscriptionInput): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const transcript = shouldUseGeminiFilesApi(input.buffer.byteLength)
        ? await this.transcribeWithUploadedFile(input, controller.signal)
        : await this.transcribeInline(input, controller.signal);

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

  private async transcribeInline(input: VoiceTranscriptionInput, signal: AbortSignal): Promise<string> {
    const mimeType = normalizeGeminiMimeType(input.mimeType);
    const payload: {
      contents: Array<{
        parts: [GeminiTextPart, GeminiInlineDataPart];
      }>;
    } = {
      contents: [
        {
          parts: [
            {
              text: transcriptionPrompt.replace("${language}", this.options.language?.trim() || "es")
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: input.buffer.toString("base64")
              }
            }
          ]
        }
      ]
    };

    return this.generateTranscript(payload, signal);
  }

  private async transcribeWithUploadedFile(
    input: VoiceTranscriptionInput,
    signal: AbortSignal
  ): Promise<string> {
    const mimeType = normalizeGeminiMimeType(input.mimeType);
    const uploadUrl = await this.startResumableUpload(
      input.buffer.byteLength,
      mimeType,
      input.fileName,
      signal
    );

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(input.buffer.byteLength),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize"
      },
      body: new Uint8Array(input.buffer),
      signal
    });

    if (!uploadResponse.ok) {
      const upstreamMessage = await readGeminiErrorMessage(uploadResponse);
      throw new DomainException(
        `Servicio de voz no disponible (${uploadResponse.status})${upstreamMessage ? ` ${upstreamMessage}` : ""}`,
        502
      );
    }

    const uploadPayload = (await uploadResponse.json()) as GeminiFileUploadResponse;
    const fileUri = uploadPayload.file?.uri?.trim();
    const uploadedMimeType = uploadPayload.file?.mimeType ?? uploadPayload.file?.mime_type ?? mimeType;

    if (!fileUri) {
      throw new DomainException("No se pudo transcribir el audio", 422);
    }

    const payload: {
      contents: Array<{
        parts: [GeminiTextPart, GeminiFileDataPart];
      }>;
    } = {
      contents: [
        {
          parts: [
            {
              text: transcriptionPrompt.replace("${language}", this.options.language?.trim() || "es")
            },
            {
              file_data: {
                mime_type: uploadedMimeType,
                file_uri: fileUri
              }
            }
          ]
        }
      ]
    };

    return this.generateTranscript(payload, signal);
  }

  private async startResumableUpload(
    contentLength: number,
    mimeType: string,
    fileName: string,
    signal: AbortSignal
  ): Promise<string> {
    const response = await fetch(`${this.endpoints.uploadBaseUrl}/files`, {
      method: "POST",
      headers: {
        "x-goog-api-key": this.options.apiKey,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(contentLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file: {
          display_name: fileName || "audio"
        }
      }),
      signal
    });

    if (!response.ok) {
      const upstreamMessage = await readGeminiErrorMessage(response);
      throw new DomainException(
        `Servicio de voz no disponible (${response.status})${upstreamMessage ? ` ${upstreamMessage}` : ""}`,
        502
      );
    }

    const uploadUrl = response.headers.get("x-goog-upload-url")?.trim();
    if (!uploadUrl) {
      throw new DomainException("Servicio de voz no disponible", 502);
    }

    return uploadUrl;
  }

  private async generateTranscript(payload: object, signal: AbortSignal): Promise<string> {
    const response = await fetch(
      `${this.endpoints.generateBaseUrl}/models/${encodeURIComponent(this.options.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.options.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal
      }
    );

    if (!response.ok) {
      const upstreamMessage = await readGeminiErrorMessage(response);
      throw new DomainException(
        `Servicio de voz no disponible (${response.status})${upstreamMessage ? ` ${upstreamMessage}` : ""}`,
        502
      );
    }

    const responsePayload = (await response.json()) as GeminiGenerateContentResponse;
    return extractGeminiText(responsePayload) ?? "";
  }
}
