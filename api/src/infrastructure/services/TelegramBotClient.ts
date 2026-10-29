import type { OrderImageInput } from "../../domain/ports/OrderImageParser.js";
import type { VoiceTranscriptionInput } from "../../domain/ports/VoiceTranscriber.js";

interface TelegramFile {
  file_path?: string;
}

interface TelegramVoice {
  file_id: string;
}

interface TelegramPhoto {
  file_id: string;
  file_size?: number;
}

interface TelegramDocument {
  file_id: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}

interface TelegramUser {
  id: number;
}

export interface TelegramMessage {
  chat: { id: number };
  from?: TelegramUser;
  text?: string;
  caption?: string;
  voice?: TelegramVoice;
  audio?: TelegramVoice;
  photo?: TelegramPhoto[];
  document?: TelegramDocument;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export interface TelegramBotCommand {
  command: string;
  description: string;
}

interface TelegramBotClientOptions {
  fetchImplementation?: typeof fetch;
  retryDelaysMs?: number[];
  waitImplementation?: (milliseconds: number) => Promise<void>;
}

export class TelegramMessageDeliveryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TelegramMessageDeliveryError";
  }
}

const defaultWait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isRetryableTelegramStatus = (status: number): boolean =>
  status === 429 || status >= 500;

const parseResponse = async <T>(response: Response): Promise<TelegramResponse<T>> => {
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || !("ok" in value)) {
    throw new Error("Respuesta no válida de Telegram");
  }
  return value as TelegramResponse<T>;
};

export class TelegramBotClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly retryDelaysMs: number[];
  private readonly waitImplementation: (milliseconds: number) => Promise<void>;

  public constructor(
    private readonly token: string,
    options: TelegramBotClientOptions = {}
  ) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.retryDelaysMs = options.retryDelaysMs ?? [250, 750, 1_500];
    this.waitImplementation = options.waitImplementation ?? defaultWait;
  }

  private url(method: string): string {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  public async getUpdates(
    offset: number,
    timeoutSeconds: number,
    signal: AbortSignal
  ): Promise<TelegramUpdate[]> {
    const response = await this.fetchImplementation(this.url("getUpdates"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        offset,
        timeout: timeoutSeconds,
        allowed_updates: ["message", "callback_query"]
      }),
      signal
    });
    const payload = await parseResponse<TelegramUpdate[]>(response);
    if (!response.ok || !payload.ok || !payload.result) {
      throw new Error(payload.description ?? "Telegram no devolvió actualizaciones");
    }
    return payload.result;
  }

  public async sendMessage(
    chatId: string,
    text: string,
    inlineKeyboard?: Array<Array<{ text: string; callbackData: string }>>
  ): Promise<void> {
    const request: RequestInit = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(inlineKeyboard && inlineKeyboard.length > 0
          ? {
              reply_markup: {
                inline_keyboard: inlineKeyboard.map((row) => row.map((button) => ({
                  text: button.text,
                  callback_data: button.callbackData
                })))
              }
            }
          : {})
      })
    };
    let lastErrorMessage = "Telegram no pudo enviar el mensaje";

    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt += 1) {
      try {
        const response = await this.fetchImplementation(this.url("sendMessage"), request);
        const payload = await parseResponse<unknown>(response);
        if (response.ok && payload.ok) return;

        lastErrorMessage = payload.description ?? lastErrorMessage;
        if (!isRetryableTelegramStatus(response.status)) {
          throw new TelegramMessageDeliveryError(lastErrorMessage);
        }
      } catch (error: unknown) {
        if (error instanceof TelegramMessageDeliveryError) throw error;
        lastErrorMessage = error instanceof Error ? error.message : lastErrorMessage;
      }

      const retryDelay = this.retryDelaysMs[attempt];
      if (retryDelay == null) {
        throw new TelegramMessageDeliveryError(lastErrorMessage);
      }
      await this.waitImplementation(retryDelay);
    }
  }

  public async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    const response = await this.fetchImplementation(this.url("answerCallbackQuery"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId })
    });
    const payload = await parseResponse<boolean>(response);
    if (!response.ok || !payload.ok) {
      throw new Error(payload.description ?? "Telegram no pudo cerrar la selección");
    }
  }

  public async setMyCommands(commands: TelegramBotCommand[]): Promise<void> {
    const response = await this.fetchImplementation(this.url("setMyCommands"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commands })
    });
    const payload = await parseResponse<boolean>(response);
    if (!response.ok || !payload.ok) {
      throw new Error(payload.description ?? "Telegram no pudo actualizar los comandos");
    }
  }

  private async downloadFile(
    fileId: string,
    maxBytes: number,
    fallbackFileName: string
  ): Promise<VoiceTranscriptionInput> {
    const fileResponse = await this.fetchImplementation(this.url("getFile"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file_id: fileId })
    });
    const filePayload = await parseResponse<TelegramFile>(fileResponse);
    const filePath = filePayload.result?.file_path;
    if (!fileResponse.ok || !filePayload.ok || !filePath) {
      throw new Error(filePayload.description ?? "Telegram no pudo resolver el archivo");
    }

    const response = await this.fetchImplementation(
      `https://api.telegram.org/file/bot${this.token}/${filePath}`
    );
    if (!response.ok) throw new Error("Telegram no pudo descargar el archivo");
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > maxBytes) throw new Error("El archivo supera el tamaño permitido");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new Error("El archivo supera el tamaño permitido");

    return {
      buffer,
      mimeType: response.headers.get("content-type") ?? "application/octet-stream",
      fileName: filePath.split("/").at(-1) ?? fallbackFileName
    };
  }

  public async downloadAudio(
    fileId: string,
    maxBytes: number
  ): Promise<VoiceTranscriptionInput> {
    const input = await this.downloadFile(fileId, maxBytes, "telegram-audio.ogg");
    return input.mimeType === "application/octet-stream"
      ? { ...input, mimeType: "audio/ogg" }
      : input;
  }

  public async downloadImage(
    fileId: string,
    maxBytes: number,
    declaredMimeType = "image/jpeg"
  ): Promise<OrderImageInput> {
    const input = await this.downloadFile(fileId, maxBytes, "telegram-image.jpg");
    const mimeType = input.mimeType === "application/octet-stream"
      ? declaredMimeType
      : input.mimeType;
    if (!mimeType.startsWith("image/")) {
      throw new Error("El archivo recibido no es una imagen compatible");
    }
    return { ...input, mimeType };
  }
}
