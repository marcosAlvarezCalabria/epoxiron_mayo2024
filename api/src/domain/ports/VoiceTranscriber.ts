export interface VoiceTranscriptionInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface VoiceTranscriber {
  transcribe(input: VoiceTranscriptionInput): Promise<string>;
}
