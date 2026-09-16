import { describe, expect, it } from "vitest";
import { buildDeliveryNoteItemDescription } from "../src/domain/services/deliveryNoteItemDescription.js";

const buildLinearDescription = (description: string) =>
  buildDeliveryNoteItemDescription({
    description,
    color: "RAL 7035",
    texture: "GOFRADO",
    pricingMode: "DIMENSIONS",
    linearMeters: 0.48
  });

describe("buildDeliveryNoteItemDescription", () => {
  it.each([
    "CHAPA 7035 GOFRADO 0,48MLIN",
    "CHAPA 7035 GOFRADO 0,48MLINEAL",
    "CHAPA 7035 GOFRADO 0,48 M LINEAL",
    "CHAPA 7035 GOFRADO 0,48 METROS LINEALES"
  ])("does not duplicate a linear measure already present in %s", (description) => {
    expect(buildLinearDescription(description)).toBe(description);
  });

  it("adds the linear measure when the description does not include it", () => {
    expect(buildLinearDescription("CHAPA 7035 GOFRADO")).toBe(
      "CHAPA 7035 GOFRADO \u00B7 0,48MLIN"
    );
  });
});
