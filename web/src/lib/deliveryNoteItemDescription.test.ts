import { describe, expect, it } from "vitest";
import {
  buildDeliveryNoteItemDescription,
  inferEmbeddedColorAndTexture,
  normalizeDeliveryNoteDescriptionInput,
  normalizeSpecialPieceName
} from "./deliveryNoteItemDescription";

const middleDot = "\u00B7";

describe("deliveryNoteItemDescription helpers", () => {
  it("detects embedded combined RAL colors and texture markers", () => {
    expect(inferEmbeddedColorAndTexture("JUNQUILLO 9005+7024 2.3MLIN")).toEqual({
      color: "RAL 9005+7024",
      texture: null
    });

    expect(inferEmbeddedColorAndTexture("BARRA Z 9016 TEXT")).toEqual({
      color: "RAL 9016",
      texture: "TEXTURADO"
    });
  });

  it("does not duplicate color or texture already embedded in the description", () => {
    expect(
      buildDeliveryNoteItemDescription({
        description: "BASTIDOR LATERAL 9005+7024 3000X1500",
        color: "RAL 9005+7024",
        texture: "NORMAL",
        pricingMode: "UNIT"
      })
    ).toBe("BASTIDOR LATERAL 9005+7024 3000X1500");

    expect(
      buildDeliveryNoteItemDescription({
        description: "BARRA Z 9016 TEXT",
        color: "RAL 9016",
        texture: "TEXTURADO",
        pricingMode: "UNIT"
      })
    ).toBe("BARRA Z 9016 TEXT");
  });

  it("normalizes manual descriptions to uppercase and removes trailing unidad", () => {
    expect(
      normalizeDeliveryNoteDescriptionInput(`papelera 510x510x2+510x1120x4 ${middleDot} ral 9003 ${middleDot} unidad`)
    ).toBe(`PAPELERA 510X510X2+510X1120X4 ${middleDot} RAL 9003`);
  });

  it("keeps special-piece matching normalization compatible with spoken variants", () => {
    expect(normalizeSpecialPieceName("GONDOLA KADO+CAJON+CHAPA")).toBe(
      normalizeSpecialPieceName("gondola cado cajon mas chapa")
    );
  });

  it("prefers explicit spoken dimensions over calculated M2 in the rendered description", () => {
    expect(
      buildDeliveryNoteItemDescription({
        description: "CHAPA 3000X1000",
        color: "RAL 9005",
        texture: "NORMAL",
        pricingMode: "DIMENSIONS",
        squareMeters: 3
      })
    ).toBe(`CHAPA 3000X1000 ${middleDot} RAL 9005`);
  });
});
