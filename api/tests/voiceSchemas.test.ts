import { describe, expect, it } from "vitest";
import { DomainException } from "../src/domain/exceptions/DomainException.js";
import { normalizeParsedVoiceAlbaran } from "../src/schemas/voiceSchemas.js";

describe("normalizeParsedVoiceAlbaran", () => {
  it("normalizes texture values and numeric strings", () => {
    const result = normalizeParsedVoiceAlbaran({
      customerName: "Cliente Uno",
      date: "2026-06-11",
      notes: "repasar",
      items: [
        {
          description: "barandilla",
          color: "RAL 7016",
          specialPieceIntent: true,
          texture: "gofrado",
          linearMeters: "12,5",
          squareMeters: null,
          thickness: "1",
          primer: true,
          quantity: "2"
        }
      ]
    });

    expect(result).toEqual({
      customerName: "CLIENTE UNO",
      date: "2026-06-11",
      notes: "REPASAR",
      items: [
        {
          description: "BARANDILLA",
          color: "RAL 7016",
          specialPieceIntent: true,
          pricingMode: "DIMENSIONS",
          customUnitPrice: null,
          texture: "GOFRADO",
          linearMeters: 12.5,
          squareMeters: null,
          hasThickness: true,
          hasPrimer: true,
          saveAsSpecialPiece: false,
          quantity: 2
        }
      ]
    });
  });

  it("rejects non-positive quantities instead of changing their sign or defaulting them", () => {
    expect(() =>
      normalizeParsedVoiceAlbaran({
        customerName: null,
        date: "2026-06-11T10:00:00.000Z",
        notes: null,
        items: [
          {
            description: "perfil",
            color: null,
            specialPieceIntent: null,
            texture: null,
            linearMeters: -1,
            squareMeters: "",
            thickness: null,
            primer: "no",
            quantity: "0"
          }
        ]
      })
    ).toThrow();
  });

  it("normalizes common colors and discards dictated prices", () => {
    const result = normalizeParsedVoiceAlbaran({
      customerName: "Cliente Uno",
      date: "2026-06-11",
      notes: null,
      items: [
        {
          description: "chapa",
          color: "negro",
          specialPieceIntent: false,
          pricingMode: "unit",
          customUnitPrice: 99,
          texture: "normal",
          linearMeters: null,
          squareMeters: 0.5,
          hasThickness: false,
          hasPrimer: false,
          saveAsSpecialPiece: false,
          quantity: 1
        }
      ]
    });

    expect(result.items[0]).toMatchObject({
      color: "RAL 9005",
      pricingMode: "DIMENSIONS",
      customUnitPrice: null,
      quantity: 1
    });
  });

  it("throws when no valid items remain", () => {
    expect(() =>
      normalizeParsedVoiceAlbaran({
        customerName: null,
        date: "2026-06-11",
        notes: null,
        items: []
      })
    ).toThrowError(new DomainException("No se pudo interpretar el texto", 422));
  });
});
