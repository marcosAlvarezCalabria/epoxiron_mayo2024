import { describe, expect, it } from "vitest";
import { validateProductionWebEnv } from "./validateProductionEnv";

const validEnv = {
  VITE_API_URL: "https://api.wwwmarcos-alvarez.com",
  VITE_GOOGLE_CLIENT_ID:
    "20604165419-dps72fkkha457807c56d39cqlj5g2j4v.apps.googleusercontent.com"
};

describe("validateProductionWebEnv", () => {
  it("acepta la configuracion real de produccion", () => {
    expect(validateProductionWebEnv(validEnv)).toEqual([]);
  });

  it("rechaza un build sin Google Client ID", () => {
    expect(validateProductionWebEnv({
      ...validEnv,
      VITE_GOOGLE_CLIENT_ID: undefined
    })).toContain("VITE_GOOGLE_CLIENT_ID es obligatorio en builds de produccion");
  });

  it("rechaza un cliente OAuth distinto al autorizado", () => {
    expect(validateProductionWebEnv({
      ...validEnv,
      VITE_GOOGLE_CLIENT_ID: "123-otro.apps.googleusercontent.com"
    })).toContain("VITE_GOOGLE_CLIENT_ID no coincide con el cliente OAuth de produccion");
  });

  it.each([
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://app.example.com"
  ])("rechaza una API no publica: %s", (apiUrl) => {
    expect(validateProductionWebEnv({
      ...validEnv,
      VITE_API_URL: apiUrl
    }).length).toBeGreaterThan(0);
  });
});

