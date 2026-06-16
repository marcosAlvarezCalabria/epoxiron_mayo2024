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
}

interface GeminiFileUploadResponse {
  file?: {
    uri?: string;
    mimeType?: string;
    mime_type?: string;
  };
}

interface GeminiEndpoints {
  generateBaseUrl: string;
  uploadBaseUrl: string;
}

const INLINE_AUDIO_MAX_BYTES = 20 * 1024 * 1024;

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

export const resolveGeminiEndpoints = (baseUrl: string): GeminiEndpoints => {
  const trimmed = trimTrailingSlashes(baseUrl);
  const normalized = trimmed.includes("/upload/") ? trimmed.replace("/upload/", "/") : trimmed;

  if (normalized.endsWith("/v1beta") || normalized.endsWith("/v1")) {
    return {
      generateBaseUrl: normalized,
      uploadBaseUrl: normalized.replace(/\/(v1beta|v1)$/, "/upload/$1")
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
  const transcript = parts
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

  return transcript || null;
};

export const shouldUseGeminiFilesApi = (bufferSize: number): boolean => bufferSize > INLINE_AUDIO_MAX_BYTES;

export const buildGeminiTranscriptionPrompt = (language: string): string =>
  [
    `Transcribe this audio literally in ${language}.`,
    "Return only the spoken words.",
    "Do not summarize.",
    "Do not interpret.",
    "Do not complete missing details.",
    "Do not rewrite it as an order.",
    "If something is unclear, keep the closest heard sound."
  ].join(" ");

const readGeminiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message?.trim() ?? "";
  } catch {
    return "";
  }
};

export class GeminiVoiceTranscriber implements VoiceTranscriber {
  private readonly endpoints: GeminiEndpoints;

  public constructor(private readonly options: GeminiVoiceTranscriberOptions) {
    this.endpoints = resolveGeminiEndpoints(this.options.baseUrl);
  }

  public async transcribe(input: VoiceTranscriptionInput): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const mimeType = normalizeGeminiMimeType(input.mimeType);
      const transcript = shouldUseGeminiFilesApi(input.buffer.byteLength)
        ? await this.transcribeWithUploadedFile(input, mimeType, controller.signal)
        : await this.transcribeInline(input, mimeType, controller.signal);

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

  private async transcribeInline(
    input: VoiceTranscriptionInput,
    mimeType: string,
    signal: AbortSignal
  ): Promise<string> {
    const response = await fetch(
      `${this.endpoints.generateBaseUrl}/models/${encodeURIComponent(this.options.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.options.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: input.buffer.toString("base64")
                  }
                },
                {
                  text: buildGeminiTranscriptionPrompt(this.options.language?.trim() || "Spanish")
                }
              ]
            }
          ],
          generation_config: {
            temperature: 0,
            top_p: 0.1,
            top_k: 1,
            response_mime_type: "text/plain"
          }
        }),
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

    return extractGeminiText((await response.json()) as GeminiGenerateContentResponse) ?? "";
  }

  private async transcribeWithUploadedFile(
    input: VoiceTranscriptionInput,
    mimeType: string,
    signal: AbortSignal
  ): Promise<string> {
    const fileUri = await this.uploadFile(input, mimeType, signal);

    const response = await fetch(
      `${this.endpoints.generateBaseUrl}/models/${encodeURIComponent(this.options.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.options.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  file_data: {
                    file_uri: fileUri,
                    mime_type: mimeType
                  }
                },
                {
                  text: buildGeminiTranscriptionPrompt(this.options.language?.trim() || "Spanish")
                }
              ]
            }
          ],
          generation_config: {
            temperature: 0,
            top_p: 0.1,
            top_k: 1,
            response_mime_type: "text/plain"
          }
        }),
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

    return extractGeminiText((await response.json()) as GeminiGenerateContentResponse) ?? "";
  }

  private async uploadFile(
    input: VoiceTranscriptionInput,
    mimeType: string,
    signal: AbortSignal
  ): Promise<string> {
    const startResponse = await fetch(`${this.endpoints.uploadBaseUrl}/files`, {
      method: "POST",
      headers: {
        "x-goog-api-key": this.options.apiKey,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(input.buffer.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file: {
          display_name: input.fileName || "audio"
        }
      }),
      signal
    });

    if (!startResponse.ok) {
      const upstreamMessage = await readGeminiErrorMessage(startResponse);
      throw new DomainException(
        `Servicio de voz no disponible (${startResponse.status})${upstreamMessage ? ` ${upstreamMessage}` : ""}`,
        502
      );
    }

    const uploadUrl = startResponse.headers.get("x-goog-upload-url")?.trim();
    if (!uploadUrl) {
      throw new DomainException("Servicio de voz no disponible", 502);
    }

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
    if (!fileUri) {
      throw new DomainException("No se pudo transcribir el audio", 422);
    }

    return fileUri;
  }
}
