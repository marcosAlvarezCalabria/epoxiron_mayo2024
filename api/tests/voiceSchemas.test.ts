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
        widthMm: null,
        heightMm: null,
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

  it.each([
    ["oro", "ORO"],
    ["RAL oro", "ORO"],
    ["oro v200", "ORO V200"],
    ["esmerilado", "ESMERILADO"],
    ["oro envejecido esmerilado", "ORO ENVEJECIDO ESMERILADO"],
    ["bronce satinado", "BRONCE SATINADO"],
    ["9000 6", "RAL 9006"]
  ])("preserves the commercial color %s", (color, expected) => {
    const result = normalizeParsedVoiceAlbaran({
      customerName: "Cliente Uno",
      date: "2026-06-11",
      notes: null,
      items: [{
        description: "pieza",
        color,
        specialPieceIntent: false,
        texture: "normal",
        linearMeters: null,
        squareMeters: null,
        quantity: 1
      }]
    });

    expect(result.items[0]?.color).toBe(expected);
  });

  it("recovers a known RAL color beside a finish when the model leaves color empty", () => {
    const result = normalizeParsedVoiceAlbaran({
      customerName: "Eigherdeco",
      date: "2026-10-02",
      notes: null,
      items: [
        {
          description: "tubo 8019 mate",
          color: null,
          texture: "mate",
          linearMeters: 2.79,
          squareMeters: null,
          quantity: 1
        },
        {
          description: "soporte 8019 mate",
          color: null,
          texture: "mate",
          linearMeters: null,
          squareMeters: null,
          quantity: 2
        }
      ]
    });

    expect(result.items).toMatchObject([
      { description: "TUBO", color: "RAL 8019", texture: "MATE", linearMeters: 2.79 },
      { description: "SOPORTE", color: "RAL 8019", texture: "MATE", quantity: 2 }
    ]);
  });

  it.each([
    ["TUBO 9999 MATE", "MATE"],
    ["TUBO 8019", "NORMAL"],
    ["CHAPA 1400X630 TEXTURADO", "TEXTURADO"]
  ])("does not infer an unsafe color from %s", (description, texture) => {
    const result = normalizeParsedVoiceAlbaran({
      customerName: "Cliente Uno",
      date: "2026-10-02",
      notes: null,
      items: [{
        description,
        color: null,
        texture: texture.toLowerCase(),
        linearMeters: null,
        squareMeters: null,
        quantity: 1
      }]
    });

    expect(result.items[0]?.color).toBeNull();
    expect(result.items[0]?.description).toBe(description);
  });

  it("recovers an explicitly labelled known RAL without requiring a finish", () => {
    const result = normalizeParsedVoiceAlbaran({
      customerName: "Cliente Uno",
      date: "2026-10-02",
      notes: null,
      items: [{
        description: "TUBO RAL 8019",
        color: null,
        texture: "normal",
        linearMeters: 2.79,
        squareMeters: null,
        quantity: 1
      }]
    });

    expect(result.items[0]).toMatchObject({ description: "TUBO", color: "RAL 8019" });
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
