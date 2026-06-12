import type { Request, Response } from "express";
import { DomainException } from "../domain/exceptions/DomainException.js";
import type { ParseVoiceAlbaranAudioUseCase } from "../application/use-cases/parseVoiceAlbaranAudio.js";
import type { ParseVoiceAlbaranUseCase } from "../application/use-cases/parseVoiceAlbaran.js";

interface UploadedAudioFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export class VoiceController {
  public constructor(
    private readonly parseVoiceAlbaranUseCase: ParseVoiceAlbaranUseCase,
    private readonly parseVoiceAlbaranAudioUseCase: ParseVoiceAlbaranAudioUseCase
  ) {}

  public parseAlbaran = async (request: Request, response: Response) => {
    const parsed = await this.parseVoiceAlbaranUseCase.execute(request.body.transcript);
    response.json(parsed);
  };

  public parseAlbaranAudio = async (request: Request, response: Response) => {
    const file = (request as Request & { file?: UploadedAudioFile }).file;
    if (!file) {
      throw new DomainException("No se ha recibido ningun audio", 400);
    }

    const result = await this.parseVoiceAlbaranAudioUseCase.execute({
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname || "voice-input.webm"
    });

    response.json(result);
  };
}
