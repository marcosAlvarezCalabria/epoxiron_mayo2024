import type { DeliveryNoteItemDraft } from "../entities/DeliveryNote.js";
import type { ParsedVoiceAlbaranItem } from "../ports/VoiceAlbaranParser.js";

export type TelegramSessionStatus =
  | "COLLECTING"
  | "PROPOSAL_READY"
  | "CREATING"
  | "CREATED"
  | "BLOCKED";

export interface TelegramDeliveryNoteDraft {
  customerName: string | null;
  date: string | null;
  notes: string | null;
  items: ParsedVoiceAlbaranItem[];
}

export interface TelegramDeliveryNoteProposalLine {
  item: DeliveryNoteItemDraft;
  unitPrice: number;
  totalPrice: number;
}

export interface TelegramDeliveryNoteProposal {
  customerId: string;
  customerName: string;
  date: string;
  notes: string | null;
  lines: TelegramDeliveryNoteProposalLine[];
  totalAmount: number;
  preparedAt: string;
}

export interface TelegramDeliveryNoteSession {
  id: string;
  chatId: string;
  userId: string;
  lastUpdateId: number;
  status: TelegramSessionStatus;
  draft: TelegramDeliveryNoteDraft;
  proposal: TelegramDeliveryNoteProposal | null;
  proposalText: string | null;
  proposalExpiresAt: Date | null;
  deliveryNoteId: string | null;
}

export interface TelegramDeliveryNoteSessionRepository {
  getOrCreate(chatId: string, userId: string): Promise<TelegramDeliveryNoteSession>;
  reset(
    chatId: string,
    userId: string,
    updateId: number
  ): Promise<TelegramDeliveryNoteSession>;
  markProcessed(sessionId: string, updateId: number): Promise<void>;
  saveDraft(
    sessionId: string,
    updateId: number,
    draft: TelegramDeliveryNoteDraft
  ): Promise<TelegramDeliveryNoteSession>;
  saveProposal(
    sessionId: string,
    updateId: number,
    proposal: TelegramDeliveryNoteProposal,
    proposalText: string,
    expiresAt: Date
  ): Promise<TelegramDeliveryNoteSession>;
  claimProposalForCreation(
    sessionId: string,
    updateId: number,
    now: Date
  ): Promise<TelegramDeliveryNoteSession | null>;
  markCreated(sessionId: string, deliveryNoteId: string): Promise<void>;
  markBlocked(sessionId: string): Promise<void>;
}
