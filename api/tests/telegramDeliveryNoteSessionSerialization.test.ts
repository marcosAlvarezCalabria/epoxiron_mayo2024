import { describe, expect, it } from "vitest";
import {
  parseTelegramDeliveryNoteDraft,
  parseTelegramDeliveryNoteProposal
} from "../src/infrastructure/repositories/PrismaTelegramDeliveryNoteSessionRepository.js";

const dimensionalItem = {
  description: "VALLA DE LAMA 204X95",
  color: "RAL 9005",
  texture: "NORMAL" as const,
  pricingMode: "DIMENSIONS" as const,
  customUnitPrice: null,
  linearMeters: null,
  squareMeters: null,
  widthMm: 2040,
  heightMm: 950,
  hasThickness: false,
  hasPrimer: false,
  specialPieceIntent: false,
  saveAsSpecialPiece: false,
  quantity: 1
};

describe("persistencia de medidas del agente de Telegram", () => {
  it("conserva ancho y alto al recuperar el borrador de PostgreSQL", () => {
    const draft = parseTelegramDeliveryNoteDraft({
      customerName: "KRZYSZTOF HÓDOROWICZ",
      date: "2026-09-11",
      notes: null,
      items: [dimensionalItem]
    });

    expect(draft.items[0]).toMatchObject({ widthMm: 2040, heightMm: 950 });
  });

  it("conserva la pieza especial pendiente mientras espera su cantidad", () => {
    const draft = parseTelegramDeliveryNoteDraft({
      customerName: "DITRAMETAL S.L.",
      date: null,
      notes: null,
      items: [],
      pendingSpecialPiece: {
        customerId: "customer-1",
        pieceId: "piece-1"
      }
    });

    expect(draft.pendingSpecialPiece).toEqual({
      customerId: "customer-1",
      pieceId: "piece-1"
    });
  });

  it("conserva ancho y alto al recuperar una propuesta pendiente", () => {
    const proposal = parseTelegramDeliveryNoteProposal({
      customerId: "customer-1",
      customerName: "KRZYSZTOF HÓDOROWICZ",
      date: "2026-09-11",
      notes: null,
      lines: [{
        item: {
          description: dimensionalItem.description,
          color: dimensionalItem.color,
          texture: dimensionalItem.texture,
          pricingMode: dimensionalItem.pricingMode,
          customUnitPrice: null,
          linearMeters: null,
          squareMeters: null,
          widthMm: dimensionalItem.widthMm,
          heightMm: dimensionalItem.heightMm,
          thickness: null,
          primer: false,
          saveAsSpecialPiece: false,
          quantity: 1
        },
        pricingSource: "DIMENSIONS",
        unitPrice: 1,
        totalPrice: 1
      }],
      totalAmount: 1,
      preparedAt: "2026-09-11T00:00:00.000Z"
    });

    expect(proposal.lines[0]?.item).toMatchObject({
      widthMm: 2040,
      heightMm: 950
    });
  });
});
