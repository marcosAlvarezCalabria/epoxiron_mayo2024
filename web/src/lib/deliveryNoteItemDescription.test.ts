import { describe, expect, it } from "vitest";
import {
  buildDeliveryNoteItemDescription,
  inferEmbeddedColorAndTexture,
  normalizeSpecialPieceName
} from "./deliveryNoteItemDescription";

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
    ).toBe("BASTIDOR LATERAL 9005+7024 3000X1500 · UNIDAD");

    expect(
      buildDeliveryNoteItemDescription({
        description: "BARRA Z 9016 TEXT",
        color: "RAL 9016",
        texture: "TEXTURADO",
        pricingMode: "UNIT"
      })
    ).toBe("BARRA Z 9016 TEXT · UNIDAD");
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
    ).toBe("CHAPA 3000X1000 Â· RAL 9005");
  });
});
