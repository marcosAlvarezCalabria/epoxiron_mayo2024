import type { VoiceTranscriber, VoiceTranscriptionInput } from "../../domain/ports/VoiceTranscriber.js";
import type { TelegramDeliveryNoteAssistant } from "../../application/use-cases/telegramDeliveryNoteAssistant.js";
import { TelegramBotClient, type TelegramUpdate } from "./TelegramBotClient.js";

export interface TelegramDeliveryNoteBotOptions {
  allowedUserIds: string[];
  pollTimeoutSeconds: number;
  maxAudioBytes: number;
  echoTranscripts: boolean;
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

const isTranscriptionTimeout = (error: unknown): boolean =>
  error instanceof Error && error.message.toLowerCase().includes("timeout");

export class TelegramDeliveryNoteBot {
  private abortController: AbortController | null = null;
  private offset = 0;
  private running: Promise<void> | null = null;
  private readonly allowedUserIds: Set<string>;

  public constructor(
    private readonly client: TelegramBotClient,
    private readonly transcriber: VoiceTranscriber,
    private readonly assistant: TelegramDeliveryNoteAssistant,
    private readonly options: TelegramDeliveryNoteBotOptions
  ) {
    this.allowedUserIds = new Set(options.allowedUserIds);
  }

  public start(): void {
    if (this.running) return;
    this.abortController = new AbortController();
    this.running = this.poll(this.abortController.signal).finally(() => {
      this.running = null;
    });
  }

  public stop(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private async poll(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        const updates = await this.client.getUpdates(
          this.offset,
          this.options.pollTimeoutSeconds,
          signal
        );
        for (const update of updates) {
          this.offset = Math.max(this.offset, update.update_id + 1);
          await this.handleUpdate(update);
        }
      } catch (error: unknown) {
        if (isAbortError(error) || signal.aborted) return;
        console.error("[Telegram albaranes] Falló el sondeo:", error instanceof Error ? error.message : "error desconocido");
        await wait(1_000);
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.from) return;
    const chatId = String(message.chat.id);
    const userId = String(message.from.id);

    if (!this.allowedUserIds.has(userId)) {
      await this.client.sendMessage(chatId, "Usuario no autorizado para este bot.");
      return;
    }

    try {
      let text = message.text?.trim() ?? "";
      const audio = message.voice ?? message.audio;
      if (!text && audio) {
        const input = await this.client.downloadAudio(audio.file_id, this.options.maxAudioBytes);
        text = (await this.transcribeWithRetry(input)).trim();
        if (this.options.echoTranscripts && text) {
          await this.client.sendMessage(chatId, `🎙️ Entendí: “${text}”`);
        }
      }
      if (!text) {
        await this.client.sendMessage(chatId, "Envía texto o una nota de voz.");
        return;
      }

      const replies = await this.assistant.handle({
        chatId,
        userId,
        updateId: update.update_id,
        text
      });
      for (const reply of replies) {
        await this.sendChunked(chatId, reply);
      }
    } catch (error: unknown) {
      console.error("[Telegram albaranes] Mensaje rechazado:", error instanceof Error ? error.message : "error desconocido");
      await this.client.sendMessage(
        chatId,
        isTranscriptionTimeout(error)
          ? "La transcripción tardó demasiado incluso tras reintentarlo. No se ha creado ningún albarán."
          : "No pude procesar el mensaje. No se ha creado ningún albarán."
      );
    }
  }

  private async transcribeWithRetry(input: VoiceTranscriptionInput): Promise<string> {
    try {
      return await this.transcriber.transcribe(input);
    } catch (error: unknown) {
      if (!isTranscriptionTimeout(error)) throw error;
      console.warn("[Telegram albaranes] Timeout de voz; realizando un único reintento.");
      return this.transcriber.transcribe(input);
    }
  }
  private async sendChunked(chatId: string, value: string): Promise<void> {
    const maxLength = 4_000;
    for (let index = 0; index < value.length; index += maxLength) {
      await this.client.sendMessage(chatId, value.slice(index, index + maxLength));
    }
  }
}
