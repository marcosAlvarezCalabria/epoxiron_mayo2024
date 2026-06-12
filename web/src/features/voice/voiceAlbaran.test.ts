import { describe, expect, it } from "vitest";
import { buildVoiceFeedbackMessage, findCustomerByVoiceName, mapParsedVoiceItemToFormState } from "./voiceAlbaran";

describe("voiceAlbaran helpers", () => {
  it("maps parsed items to the current delivery note form shape", () => {
    expect(
      mapParsedVoiceItemToFormState({
        description: "barandilla",
        color: null,
        customUnitPrice: null,
        pricingMode: "DIMENSIONS",
        texture: "GOFRADO",
        linearMeters: 12.5,
        squareMeters: null,
        hasThickness: true,
        hasPrimer: true,
        saveAsSpecialPiece: true,
        quantity: 2
      })
    ).toEqual({
      hasThickness: true,
      hasPrimer: true,
      saveAsSpecialPiece: true,
      customUnitPrice: "",
      description: "barandilla",
      color: "",
      pricingMode: "DIMENSIONS",
      texture: "GOFRADO",
      linearMeters: "12,5",
      quantity: "2",
      squareMeters: ""
    });
  });

  it("finds customers first by exact match and then by prefix", () => {
    const customers = [
      {
        id: "1",
        name: "Pinturas Lopez",
        email: null,
        phone: null,
        address: null,
        notes: null,
        pricePerLinearMeter: 1,
        pricePerSquareMeter: 1,
        minimumRate: 1,
        grosorPrecio: null,
        specialPieces: []
      },
      {
        id: "2",
        name: "Metalicas Rubio",
        email: null,
        phone: null,
        address: null,
        notes: null,
        pricePerLinearMeter: 1,
        pricePerSquareMeter: 1,
        minimumRate: 1,
        grosorPrecio: null,
        specialPieces: []
      }
    ];

    expect(findCustomerByVoiceName(customers, "pinturas lopez")?.id).toBe("1");
    expect(findCustomerByVoiceName(customers, "metalicas")?.id).toBe("2");
    expect(findCustomerByVoiceName(customers, "desconocido")).toBeNull();
  });

  it("builds warning messages for missing customer or color", () => {
    expect(
      buildVoiceFeedbackMessage(
        {
          customerName: "Cliente X",
          date: "2026-06-11",
          notes: null,
          items: [
            {
              description: "pieza",
              color: null,
              customUnitPrice: null,
              pricingMode: "DIMENSIONS",
              texture: "NORMAL",
              linearMeters: null,
              squareMeters: null,
              hasThickness: false,
              hasPrimer: false,
              saveAsSpecialPiece: false,
              quantity: 1
            }
          ]
        },
        null
      )
    ).toContain("Cliente no encontrado");
  });
});
