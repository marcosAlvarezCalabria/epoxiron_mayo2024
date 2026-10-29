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
    ).toBe(`BASTIDOR LATERAL ${middleDot} 9005+7024 ${middleDot} 3000X1500`);

    expect(
      buildDeliveryNoteItemDescription({
        description: "BARRA Z 9016 TEXT",
        color: "RAL 9016",
        texture: "TEXTURADO",
        pricingMode: "UNIT"
      })
    ).toBe(`BARRA Z ${middleDot} 9016 ${middleDot} TEXT`);

    expect(
      buildDeliveryNoteItemDescription({
        description: "ARMARIO 7032 GOF 1550X1680",
        color: "RAL 7032",
        texture: "GOFRADO",
        pricingMode: "UNIT"
      })
    ).toBe(`ARMARIO ${middleDot} 7032 ${middleDot} GOF ${middleDot} 1550X1680`);
  });

  it("normalizes manual descriptions removing ral and unidad from line text", () => {
    expect(
      normalizeDeliveryNoteDescriptionInput(`papelera 510x510x2+510x1120x4 ${middleDot} ral 9003 ${middleDot} unidad`)
    ).toBe(`PAPELERA 510X510X2+510X1120X4 ${middleDot} 9003`);
  });

  it("keeps special-piece matching normalization compatible with spoken variants", () => {
    expect(normalizeSpecialPieceName("GONDOLA KADO+CAJON+CHAPA")).toBe(
      normalizeSpecialPieceName("gondola cado cajon mas chapa")
    );
  });

  it("renders stored dimensions in millimeters instead of square meters", () => {
    expect(
      buildDeliveryNoteItemDescription({
        description: "CHAPA",
        color: "ORO",
        texture: "NORMAL",
        pricingMode: "DIMENSIONS",
        squareMeters: 2,
        widthMm: 2500,
        heightMm: 800
      })
    ).toBe(`CHAPA ${middleDot} ORO ${middleDot} 2500X800MM`);
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
    ).toBe(`CHAPA ${middleDot} 9005 ${middleDot} 3000X1000`);
  });

  it("orders color and texture before dimensions without duplicating them", () => {
    expect(
      buildDeliveryNoteItemDescription({
        description: "CHAPA TEXTURADO 1400X630",
        color: "RAL 7021",
        texture: "TEXTURADO",
        pricingMode: "DIMENSIONS",
        widthMm: 1400,
        heightMm: 630
      })
    ).toBe(`CHAPA ${middleDot} 7021 ${middleDot} TEXTURADO ${middleDot} 1400X630`);
  });

  it("renders linear meters only once when they were also embedded in the description", () => {
    expect(
      buildDeliveryNoteItemDescription({
        description: "TUBO 2M",
        color: "RAL 9005",
        texture: "MATE",
        pricingMode: "DIMENSIONS",
        linearMeters: 2
      })
    ).toBe(`TUBO ${middleDot} 9005 ${middleDot} MATE ${middleDot} 2MLIN`);
  });

  it("keeps linear meters when the description also contains explicit dimensions", () => {
    expect(
      buildDeliveryNoteItemDescription({
        description: "TABURETE 220X220",
        color: "RAL 9005",
        texture: "NORMAL",
        pricingMode: "DIMENSIONS",
        linearMeters: 4.5,
        widthMm: 220,
        heightMm: 220
      })
    ).toBe(`TABURETE ${middleDot} 9005 ${middleDot} 220X220 ${middleDot} 4.5MLIN`);
  });

  it("uses the same separators for a profile with color, finish and dimensions", () => {
    expect(
      buildDeliveryNoteItemDescription({
        description: "PERFIL 1460X200",
        color: "RAL 1023",
        texture: "MATE",
        pricingMode: "DIMENSIONS",
        widthMm: 1460,
        heightMm: 200
      })
    ).toBe(`PERFIL ${middleDot} 1023 ${middleDot} MATE ${middleDot} 1460X200`);
  });
});
