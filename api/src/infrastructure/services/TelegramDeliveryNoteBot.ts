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
    try {
      await this.client.setMyCommands([
        { command: "start", description: "Mostrar el manual" },
        { command: "new", description: "Empezar un albarán nuevo" },
        { command: "especiales", description: "Ver piezas especiales de un cliente" },
        { command: "help", description: "Mostrar la ayuda" }
      ]);
    } catch (error: unknown) {
      console.warn(
        "[Telegram albaranes] No se pudo actualizar el menú:",
        error instanceof Error ? error.message : "error desconocido"
      );
    }
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
    const callback = update.callback_query;
    const message = update.message ?? callback?.message;
    if (callback && message) {
      await this.handleCallback(update, String(message.chat.id), String(callback.from.id));
      return;
    }
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

      const assistantInput = {
        chatId,
        userId,
        updateId: update.update_id,
        text
      };
      const buttons = await this.assistant.getSpecialPieceButtons(assistantInput);
      const replies = await this.assistant.handle(assistantInput);
      for (const [index, reply] of replies.entries()) {
        await this.sendChunked(chatId, reply, index === 0 ? buttons : null);
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

  private async handleCallback(
    update: TelegramUpdate,
    chatId: string,
    userId: string
  ): Promise<void> {
    const callback = update.callback_query;
    if (!callback) return;
    if (!this.allowedUserIds.has(userId)) {
      await this.client.answerCallbackQuery(callback.id);
      await this.client.sendMessage(chatId, "Usuario no autorizado para este bot.");
      return;
    }

    const pieceId = callback.data?.match(/^special:([0-9a-f-]{36})$/i)?.[1];
    try {
      if (!pieceId) {
        await this.client.sendMessage(chatId, "Esa selección no es válida.");
        return;
      }
      const replies = await this.assistant.selectSpecialPiece({
        chatId,
        userId,
        updateId: update.update_id,
        pieceId
      });
      for (const reply of replies) await this.sendChunked(chatId, reply, null);
    } finally {
      try {
        await this.client.answerCallbackQuery(callback.id);
      } catch (error: unknown) {
        console.warn(
          "[Telegram albaranes] No se pudo cerrar la selección:",
          error instanceof Error ? error.message : "error desconocido"
        );
      }
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
  private async sendChunked(
    chatId: string,
    value: string,
    buttons: Array<Array<{ text: string; callbackData: string }>> | null
  ): Promise<void> {
    const maxLength = 4_000;
    for (let index = 0; index < value.length; index += maxLength) {
      const isLastChunk = index + maxLength >= value.length;
      await this.client.sendMessage(
        chatId,
        value.slice(index, index + maxLength),
        isLastChunk ? buttons ?? undefined : undefined
      );
    }
  }
}
