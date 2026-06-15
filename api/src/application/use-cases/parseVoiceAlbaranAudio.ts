import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { ParsedVoiceAlbaran } from "../../domain/ports/VoiceAlbaranParser.js";
import type { VoiceTranscriber, VoiceTranscriptionInput } from "../../domain/ports/VoiceTranscriber.js";
import { normalizeVoiceTranscript } from "./normalizeVoiceTranscript.js";
import type { ParseVoiceAlbaranUseCase } from "./parseVoiceAlbaran.js";

export interface ParsedVoiceAlbaranAudioResult {
  transcript: string;
  parsed: ParsedVoiceAlbaran;
}

export class ParseVoiceAlbaranAudioUseCase {
  public constructor(
    private readonly voiceTranscriber: VoiceTranscriber,
    private readonly parseVoiceAlbaranUseCase: ParseVoiceAlbaranUseCase
  ) {}

  public async execute(input: VoiceTranscriptionInput): Promise<ParsedVoiceAlbaranAudioResult> {
    const transcript = normalizeVoiceTranscript(await this.voiceTranscriber.transcribe(input));
    let parsed: ParsedVoiceAlbaran;

    try {
      parsed = await this.parseVoiceAlbaranUseCase.execute(transcript);
    } catch (error) {
      if (error instanceof DomainException && error.statusCode === 422) {
        throw new DomainException(
          `${error.message}. Transcript detectado: ${transcript.slice(0, 800)}`,
          error.statusCode
        );
      }

      throw error;
    }

    return {
      transcript,
      parsed
    };
  }
}
