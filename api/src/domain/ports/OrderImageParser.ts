import type {
  ParsedVoiceAlbaran,
  VoiceAlbaranParserContext
} from "./VoiceAlbaranParser.js";

export interface OrderImageInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  caption?: string;
}

export interface OrderImageParser {
  parseImage(
    input: OrderImageInput,
    context?: VoiceAlbaranParserContext
  ): Promise<ParsedVoiceAlbaran>;
}
