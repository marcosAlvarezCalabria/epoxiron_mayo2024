import type { VoiceTranscriber, VoiceTranscriptionInput } from "../../domain/ports/VoiceTranscriber.js";
import type { ParseOrderImageUseCase } from "../../application/use-cases/parseOrderImage.js";
import type { ParsedVoiceAlbaran } from "../../domain/ports/VoiceAlbaranParser.js";
import type { TelegramDeliveryNoteAssistant } from "../../application/use-cases/telegramDeliveryNoteAssistant.js";
import { TelegramBotClient, type TelegramUpdate } from "./TelegramBotClient.js";

export interface TelegramDeliveryNoteBotOptions {
  allowedUserIds: string[];
  pollTimeoutSeconds: number;
  maxAudioBytes: number;
  maxImageBytes: number;
  echoTranscripts: boolean;
  echoImageTranscriptions: boolean;
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

const isTranscriptionTimeout = (error: unknown): boolean =>
  error instanceof Error && error.message.toLowerCase().includes("timeout");

const parsedImageText = (parsed: ParsedVoiceAlbaran): string => [
  "🖼️ Leí:",
  `Cliente: ${parsed.customerName ?? "NO IDENTIFICADO"}`,
  `Fecha: ${parsed.date}`,
  ...parsed.items.map((item, index) => [
    `${index + 1}. ${item.description}`,
    `${item.quantity} ud.`,
    item.linearMeters != null ? `${item.linearMeters} ml/ud.` : null,
    item.widthMm != null && item.heightMm != null
      ? `${item.widthMm}×${item.heightMm} mm`
      : null,
    item.color,
    item.texture
  ].filter(Boolean).join(" · ")),
  parsed.notes ? `Notas: ${parsed.notes}` : null
].filter((line): line is string => line !== null).join("\n");

export class TelegramDeliveryNoteBot {
  private abortController: AbortController | null = null;
  private offset = 0;
  private running: Promise<void> | null = null;
  private readonly allowedUserIds: Set<string>;

  public constructor(
    private readonly client: TelegramBotClient,
    private readonly transcriber: VoiceTranscriber,
    private readonly imageParser: Pick<ParseOrderImageUseCase, "execute"> | null,
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
      const caption = message.caption?.trim() ?? "";
      const audio = message.voice ?? message.audio;
      const photo = message.photo?.at(-1);
      const imageDocument = message.document?.mime_type?.startsWith("image/")
        ? message.document
        : undefined;
      const image = photo ?? imageDocument;

      if (image) {
        if (!this.imageParser) {
          await this.client.sendMessage(
            chatId,
            "La lectura de imágenes no está habilitada todavía."
          );
          return;
        }
        const downloadedImage = await this.client.downloadImage(
          image.file_id,
          this.options.maxImageBytes,
          photo ? "image/jpeg" : imageDocument?.mime_type
        );
        const parsedImage = await this.imageParser.execute({
          ...downloadedImage,
          caption: caption || undefined
        });
        if (this.options.echoImageTranscriptions) {
          try {
            await this.sendChunked(chatId, parsedImageText(parsedImage), null);
          } catch (error: unknown) {
            console.warn(
              "[Telegram albaranes] No se pudo enviar el eco de la imagen; se continúa procesando:",
              error instanceof Error ? error.message : "error desconocido"
            );
          }
        }
        const replies = await this.assistant.handleParsedOrder({
          chatId,
          userId,
          updateId: update.update_id,
          parsed: parsedImage
        });
        try {
          for (const reply of replies) await this.sendChunked(chatId, reply, null);
        } catch (error: unknown) {
          console.error(
            "[Telegram albaranes] Respuesta procesada pero no entregada:",
            error instanceof Error ? error.message : "error desconocido"
          );
          await this.sendDeliveryFailureNotice(chatId);
        }
        return;
      } else if (!text && audio) {
        const input = await this.client.downloadAudio(audio.file_id, this.options.maxAudioBytes);
        text = (await this.transcribeWithRetry(input)).trim();
        if (this.options.echoTranscripts && text) {
          try {
            await this.client.sendMessage(chatId, `🎙️ Entendí: “${text}”`);
          } catch (error: unknown) {
            console.warn(
              "[Telegram albaranes] No se pudo enviar el eco de la transcripción; se continúa procesando:",
              error instanceof Error ? error.message : "error desconocido"
            );
          }
        }
      }

      if (!text) {
        await this.client.sendMessage(
          chatId,
          "Envía texto, una nota de voz o una foto del pedido."
        );
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
      try {
        for (const [index, reply] of replies.entries()) {
          await this.sendChunked(chatId, reply, index === 0 ? buttons : null);
        }
      } catch (error: unknown) {
        console.error(
          "[Telegram albaranes] Respuesta procesada pero no entregada:",
          error instanceof Error ? error.message : "error desconocido"
        );
        await this.sendDeliveryFailureNotice(chatId);
      }
    } catch (error: unknown) {
      console.error("[Telegram albaranes] Mensaje rechazado:", error instanceof Error ? error.message : "error desconocido");
      await this.sendProcessingFailureNotice(
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
    const pageMatch = callback.data?.match(/^special-page:([0-9a-f-]{36}):(\d+)$/i);
    try {
      if (pageMatch?.[1] && pageMatch[2]) {
        const page = Number.parseInt(pageMatch[2], 10);
        const result = await this.assistant.getSpecialPiecesPage(pageMatch[1], page);
        if (!result) {
          await this.client.sendMessage(chatId, "Esa página ya no está disponible. Vuelve a abrir /especiales.");
          return;
        }
        await this.sendChunked(chatId, result.text, result.buttons);
        return;
      }
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

  private async sendDeliveryFailureNotice(chatId: string): Promise<void> {
    try {
      await this.client.sendMessage(
        chatId,
        "El mensaje ya fue procesado, pero no pude entregar la respuesta completa. " +
        "No repitas el audio: escribe YA ESTÁ para revisar el borrador."
      );
    } catch (error: unknown) {
      console.error(
        "[Telegram albaranes] Tampoco se pudo entregar el aviso de recuperación:",
        error instanceof Error ? error.message : "error desconocido"
      );
    }
  }

  private async sendProcessingFailureNotice(chatId: string, message: string): Promise<void> {
    try {
      await this.client.sendMessage(chatId, message);
    } catch (error: unknown) {
      console.error(
        "[Telegram albaranes] No se pudo entregar el aviso de error:",
        error instanceof Error ? error.message : "error desconocido"
      );
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
