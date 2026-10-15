const expectedGoogleClientId =
  "20604165419-dps72fkkha457807c56d39cqlj5g2j4v.apps.googleusercontent.com";

const loopbackHosts = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1"]);

export interface ProductionWebEnv {
  VITE_API_URL?: string;
  VITE_GOOGLE_CLIENT_ID?: string;
}

export const validateProductionWebEnv = (env: ProductionWebEnv): string[] => {
  const errors: string[] = [];
  const apiUrl = env.VITE_API_URL?.trim();
  const googleClientId = env.VITE_GOOGLE_CLIENT_ID?.trim();

  if (!apiUrl) {
    errors.push("VITE_API_URL es obligatoria en builds de produccion");
  } else {
    try {
      const parsedApiUrl = new URL(apiUrl);
      if (parsedApiUrl.protocol !== "https:") {
        errors.push("VITE_API_URL debe usar HTTPS en produccion");
      }
      if (
        loopbackHosts.has(parsedApiUrl.hostname) ||
        parsedApiUrl.hostname.endsWith(".localhost") ||
        parsedApiUrl.hostname.includes("example.com")
      ) {
        errors.push("VITE_API_URL no puede apuntar a localhost, comodines ni ejemplos");
      }
    } catch {
      errors.push("VITE_API_URL debe ser una URL valida");
    }
  }

  if (!googleClientId) {
    errors.push("VITE_GOOGLE_CLIENT_ID es obligatorio en builds de produccion");
  } else if (googleClientId !== expectedGoogleClientId) {
    errors.push("VITE_GOOGLE_CLIENT_ID no coincide con el cliente OAuth de produccion");
  }

  return errors;
};

export const assertProductionWebEnv = (env: ProductionWebEnv): void => {
  const errors = validateProductionWebEnv(env);
  if (errors.length > 0) {
    throw new Error(`Configuracion web de produccion invalida:\n- ${errors.join("\n- ")}`);
  }
};

