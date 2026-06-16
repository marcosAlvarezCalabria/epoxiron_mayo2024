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

  it("reuses an existing special piece from the matched customer", () => {
    expect(
      mapParsedVoiceItemToFormState(
        {
          description: "pata reforzada",
          color: "RAL 9006",
          customUnitPrice: null,
          pricingMode: "DIMENSIONS",
          texture: "NORMAL",
          linearMeters: 5,
          squareMeters: null,
          hasThickness: false,
          hasPrimer: false,
          saveAsSpecialPiece: false,
          quantity: 2
        },
        {
          id: "1",
          name: "Ditrametal",
          email: null,
          phone: null,
          address: null,
          notes: null,
          pricePerLinearMeter: 1,
          pricePerSquareMeter: 1,
          minimumRate: 1,
          grosorPrecio: null,
          specialPieces: [{ name: "Pata Reforzada", price: 18 }]
        }
      )
    ).toEqual({
      hasThickness: false,
      hasPrimer: false,
      saveAsSpecialPiece: true,
      customUnitPrice: "18",
      description: "Pata Reforzada",
      color: "RAL 9006",
      pricingMode: "UNIT",
      texture: "NORMAL",
      linearMeters: "",
      quantity: "2",
      squareMeters: ""
    });
  });

  it("matches existing workshop special pieces with symbols and spoken separators", () => {
    expect(
      mapParsedVoiceItemToFormState(
        {
          description: "gondola cado cajon mas chapa",
          color: "RAL 9005",
          customUnitPrice: null,
          pricingMode: "DIMENSIONS",
          texture: "NORMAL",
          linearMeters: null,
          squareMeters: null,
          hasThickness: false,
          hasPrimer: false,
          saveAsSpecialPiece: false,
          quantity: 1
        },
        {
          id: "1",
          name: "Ditrametal",
          email: null,
          phone: null,
          address: null,
          notes: null,
          pricePerLinearMeter: 1,
          pricePerSquareMeter: 1,
          minimumRate: 1,
          grosorPrecio: null,
          specialPieces: [{ name: "GONDOLA KADO+CAJON+CHAPA", price: 24 }]
        }
      )
    ).toMatchObject({
      description: "GONDOLA KADO+CAJON+CHAPA",
      pricingMode: "UNIT",
      customUnitPrice: "24",
      saveAsSpecialPiece: true
    });
  });

  it("does not reuse a long special piece from a generic one-word description", () => {
    expect(
      mapParsedVoiceItemToFormState(
        {
          description: "bastidor",
          color: "RAL 9005",
          customUnitPrice: null,
          pricingMode: "DIMENSIONS",
          texture: "NORMAL",
          linearMeters: 7,
          squareMeters: null,
          hasThickness: false,
          hasPrimer: false,
          saveAsSpecialPiece: false,
          quantity: 5
        },
        {
          id: "1",
          name: "Ditrametal",
          email: null,
          phone: null,
          address: null,
          notes: null,
          pricePerLinearMeter: 1,
          pricePerSquareMeter: 1,
          minimumRate: 1,
          grosorPrecio: null,
          specialPieces: [{ name: "BASTIDOR LATERAL 9005+7024 3000X1500", price: 26.72 }]
        }
      )
    ).toMatchObject({
      description: "bastidor",
      pricingMode: "DIMENSIONS",
      customUnitPrice: "",
      saveAsSpecialPiece: false,
      linearMeters: "7"
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
