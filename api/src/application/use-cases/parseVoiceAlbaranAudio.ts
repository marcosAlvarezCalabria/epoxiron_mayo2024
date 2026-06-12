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
    const parsed = await this.parseVoiceAlbaranUseCase.execute(transcript);

    return {
      transcript,
      parsed
    };
  }
}
