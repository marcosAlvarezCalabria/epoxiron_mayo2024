import { describe, expect, it } from "vitest";
import { getRalColor } from "@/constants/ralColors";

describe("commercial colors", () => {
  it.each([
    ["ORO V200", "Oro V200"],
    ["ESMERILADO", "Esmerilado"],
    ["ORO ENVEJECIDO ESMERILADO", "Oro envejecido esmerilado"]
  ])("includes %s in the special RAL family", (code, name) => {
    expect(getRalColor(code)).toMatchObject({
      family: "Metalicos / especiales",
      name
    });
  });
});
