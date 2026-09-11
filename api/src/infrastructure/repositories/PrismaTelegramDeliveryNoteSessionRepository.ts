import { Prisma } from "@prisma/client";
import { z } from "zod";
import type {
  TelegramDeliveryNoteDraft,
  TelegramDeliveryNoteProposal,
  TelegramDeliveryNoteSession,
  TelegramDeliveryNoteSessionRepository,
  TelegramSessionStatus
} from "../../domain/repositories/TelegramDeliveryNoteSessionRepository.js";
import { prisma } from "../prisma/client.js";

const textureSchema = z.enum(["NORMAL", "MATE", "TEXTURADO", "GOFRADO"]);
const pricingModeSchema = z.enum(["DIMENSIONS", "UNIT"]);
const nullableNumber = z.number().nullable().optional();

const parsedItemSchema = z.object({
  description: z.string(),
  color: z.string().nullable(),
  texture: textureSchema,
  pricingMode: pricingModeSchema,
  customUnitPrice: z.number().nullable(),
  linearMeters: z.number().nullable(),
  squareMeters: z.number().nullable(),
  widthMm: nullableNumber,
  heightMm: nullableNumber,
  hasThickness: z.boolean(),
  hasPrimer: z.boolean(),
  specialPieceIntent: z.boolean(),
  saveAsSpecialPiece: z.boolean(),
  quantity: z.number()
});

const draftSchema = z.object({
  customerName: z.string().nullable(),
  date: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(parsedItemSchema)
});

const itemSchema = z.object({
  description: z.string(),
  color: z.string(),
  texture: textureSchema.optional(),
  pricingMode: pricingModeSchema.optional(),
  customUnitPrice: nullableNumber,
  linearMeters: nullableNumber,
  squareMeters: nullableNumber,
  widthMm: nullableNumber,
  heightMm: nullableNumber,
  thickness: nullableNumber,
  primer: z.boolean().optional(),
  saveAsSpecialPiece: z.boolean().optional(),
  quantity: z.number()
});

const proposalSchema = z.object({
  customerId: z.string(),
  customerName: z.string(),
  date: z.string(),
  notes: z.string().nullable(),
  lines: z.array(z.object({
    item: itemSchema,
    unitPrice: z.number(),
    totalPrice: z.number()
  })),
  totalAmount: z.number(),
  preparedAt: z.string()
});

export const parseTelegramDeliveryNoteDraft = (
  value: unknown
): TelegramDeliveryNoteDraft => draftSchema.parse(value);

export const parseTelegramDeliveryNoteProposal = (
  value: unknown
): TelegramDeliveryNoteProposal => proposalSchema.parse(value);

const statusSchema = z.enum(["COLLECTING", "PROPOSAL_READY", "CREATING", "CREATED", "BLOCKED"]);

const emptyDraft = (): TelegramDeliveryNoteDraft => ({
  customerName: null,
  date: null,
  notes: null,
  items: []
});

type SessionRecord = Awaited<ReturnType<typeof prisma.telegramDeliveryNoteSession.findUniqueOrThrow>>;

const toJson = (value: TelegramDeliveryNoteDraft | TelegramDeliveryNoteProposal): Prisma.InputJsonValue =>
  value as unknown as Prisma.InputJsonValue;

const toDomain = (record: SessionRecord): TelegramDeliveryNoteSession => ({
  id: record.id,
  chatId: record.chatId,
  userId: record.userId,
  lastUpdateId: record.lastUpdateId,
  status: statusSchema.parse(record.status) as TelegramSessionStatus,
  draft: parseTelegramDeliveryNoteDraft(record.draft),
  proposal: record.proposal == null ? null : parseTelegramDeliveryNoteProposal(record.proposal),
  proposalText: record.proposalText,
  proposalExpiresAt: record.proposalExpiresAt,
  deliveryNoteId: record.deliveryNoteId
});

export class PrismaTelegramDeliveryNoteSessionRepository
  implements TelegramDeliveryNoteSessionRepository {
  public async getOrCreate(chatId: string, userId: string) {
    const record = await prisma.telegramDeliveryNoteSession.upsert({
      where: { chatId_userId: { chatId, userId } },
      create: { chatId, userId, draft: toJson(emptyDraft()) },
      update: {}
    });
    return toDomain(record);
  }

  public async reset(chatId: string, userId: string, updateId: number) {
    const record = await prisma.telegramDeliveryNoteSession.upsert({
      where: { chatId_userId: { chatId, userId } },
      create: { chatId, userId, lastUpdateId: updateId, draft: toJson(emptyDraft()) },
      update: {
        lastUpdateId: updateId,
        status: "COLLECTING",
        draft: toJson(emptyDraft()),
        proposal: Prisma.DbNull,
        proposalText: null,
        proposalExpiresAt: null,
        deliveryNoteId: null
      }
    });
    return toDomain(record);
  }

  public async markProcessed(sessionId: string, updateId: number): Promise<void> {
    await prisma.telegramDeliveryNoteSession.updateMany({
      where: { id: sessionId, lastUpdateId: { lt: updateId } },
      data: { lastUpdateId: updateId }
    });
  }

  public async saveDraft(sessionId: string, updateId: number, draft: TelegramDeliveryNoteDraft) {
    const record = await prisma.telegramDeliveryNoteSession.update({
      where: { id: sessionId },
      data: { lastUpdateId: updateId, draft: toJson(draft) }
    });
    return toDomain(record);
  }

  public async saveProposal(
    sessionId: string,
    updateId: number,
    proposal: TelegramDeliveryNoteProposal,
    proposalText: string,
    expiresAt: Date
  ) {
    const record = await prisma.telegramDeliveryNoteSession.update({
      where: { id: sessionId },
      data: {
        lastUpdateId: updateId,
        status: "PROPOSAL_READY",
        proposal: toJson(proposal),
        proposalText,
        proposalExpiresAt: expiresAt
      }
    });
    return toDomain(record);
  }

  public async claimProposalForCreation(sessionId: string, updateId: number, now: Date) {
    const result = await prisma.telegramDeliveryNoteSession.updateMany({
      where: {
        id: sessionId,
        status: "PROPOSAL_READY",
        proposalExpiresAt: { gt: now },
        lastUpdateId: { lt: updateId }
      },
      data: { status: "CREATING", lastUpdateId: updateId }
    });
    if (result.count !== 1) return null;
    return toDomain(await prisma.telegramDeliveryNoteSession.findUniqueOrThrow({
      where: { id: sessionId }
    }));
  }

  public async markCreated(sessionId: string, deliveryNoteId: string): Promise<void> {
    await prisma.telegramDeliveryNoteSession.update({
      where: { id: sessionId },
      data: { status: "CREATED", deliveryNoteId }
    });
  }

  public async markBlocked(sessionId: string): Promise<void> {
    await prisma.telegramDeliveryNoteSession.update({
      where: { id: sessionId },
      data: { status: "BLOCKED" }
    });
  }
}
