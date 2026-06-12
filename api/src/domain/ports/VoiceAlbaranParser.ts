export type ParsedVoiceTexture = "NORMAL" | "MATE" | "TEXTURADO" | "GOFRADO";
export type ParsedVoicePricingMode = "DIMENSIONS" | "UNIT";

export interface ParsedVoiceAlbaranItem {
  description: string;
  color: string | null;
  customUnitPrice: number | null;
  pricingMode: ParsedVoicePricingMode;
  texture: ParsedVoiceTexture;
  linearMeters: number | null;
  squareMeters: number | null;
  hasThickness: boolean;
  hasPrimer: boolean;
  saveAsSpecialPiece: boolean;
  quantity: number;
}

export interface ParsedVoiceAlbaran {
  customerName: string | null;
  date: string;
  notes: string | null;
  items: ParsedVoiceAlbaranItem[];
}

export interface VoiceAlbaranParserContext {
  customerNames?: string[];
  specialPieceNames?: string[];
}

export interface VoiceAlbaranParser {
  parseTranscript(transcript: string, context?: VoiceAlbaranParserContext): Promise<ParsedVoiceAlbaran>;
}
