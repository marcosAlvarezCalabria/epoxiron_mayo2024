import type { VoiceTranscriptionInput } from "../../domain/ports/VoiceTranscriber.js";

interface TelegramFile {
  file_path?: string;
}

interface TelegramVoice {
  file_id: string;
}

interface TelegramUser {
  id: number;
}

export interface TelegramMessage {
  chat: { id: number };
  from?: TelegramUser;
  text?: string;
  voice?: TelegramVoice;
  audio?: TelegramVoice;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

const parseResponse = async <T>(response: Response): Promise<TelegramResponse<T>> => {
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || !("ok" in value)) {
    throw new Error("Respuesta no válida de Telegram");
  }
  return value as TelegramResponse<T>;
};

export class TelegramBotClient {
  public constructor(private readonly token: string) {}

  private url(method: string): string {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  public async getUpdates(
    offset: number,
    timeoutSeconds: number,
    signal: AbortSignal
  ): Promise<TelegramUpdate[]> {
    const response = await fetch(this.url("getUpdates"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        offset,
        timeout: timeoutSeconds,
        allowed_updates: ["message"]
      }),
      signal
    });
    const payload = await parseResponse<TelegramUpdate[]>(response);
    if (!response.ok || !payload.ok || !payload.result) {
      throw new Error(payload.description ?? "Telegram no devolvió actualizaciones");
    }
    return payload.result;
  }

  public async sendMessage(chatId: string, text: string): Promise<void> {
    const response = await fetch(this.url("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const payload = await parseResponse<unknown>(response);
    if (!response.ok || !payload.ok) {
      throw new Error(payload.description ?? "Telegram no pudo enviar el mensaje");
    }
  }

  public async downloadAudio(fileId: string, maxBytes: number): Promise<VoiceTranscriptionInput> {
    const fileResponse = await fetch(this.url("getFile"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file_id: fileId })
    });
    const filePayload = await parseResponse<TelegramFile>(fileResponse);
    const filePath = filePayload.result?.file_path;
    if (!fileResponse.ok || !filePayload.ok || !filePath) {
      throw new Error(filePayload.description ?? "Telegram no pudo resolver el audio");
    }

    const response = await fetch(
      `https://api.telegram.org/file/bot${this.token}/${filePath}`
    );
    if (!response.ok) throw new Error("Telegram no pudo descargar el audio");
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > maxBytes) throw new Error("El audio supera el tamaño permitido");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new Error("El audio supera el tamaño permitido");

    return {
      buffer,
      mimeType: response.headers.get("content-type") ?? "audio/ogg",
      fileName: filePath.split("/").at(-1) ?? "telegram-audio.ogg"
    };
  }
}
