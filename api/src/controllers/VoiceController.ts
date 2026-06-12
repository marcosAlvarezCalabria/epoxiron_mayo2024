import type { Request, Response } from "express";
import type { ParseVoiceAlbaranUseCase } from "../application/use-cases/parseVoiceAlbaran.js";

export class VoiceController {
  public constructor(private readonly parseVoiceAlbaranUseCase: ParseVoiceAlbaranUseCase) {}

  public parseAlbaran = async (request: Request, response: Response) => {
    const parsed = await this.parseVoiceAlbaranUseCase.execute(request.body.transcript);
    response.json(parsed);
  };
}
