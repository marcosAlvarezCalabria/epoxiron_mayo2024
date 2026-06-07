import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { GoogleIdentity, GoogleIdentityVerifier } from "../../application/use-cases/auth.js";

interface GoogleTokenInfoResponse {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
}

export class GoogleIdTokenVerifier implements GoogleIdentityVerifier {
  public constructor(private readonly clientId: string) {}

  public async verifyIdToken(credential: string): Promise<GoogleIdentity> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      );

      if (!response.ok) {
        throw new DomainException("No se pudo verificar el token de Google", 401);
      }

      const payload = (await response.json()) as GoogleTokenInfoResponse;
      const emailVerified = payload.email_verified === true || payload.email_verified === "true";

      if (payload.aud !== this.clientId || !payload.email || !emailVerified) {
        throw new DomainException("Token de Google invalido", 401);
      }

      return {
        email: payload.email,
        name: payload.name
      };
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }

      throw new DomainException("No se pudo verificar el token de Google", 401);
    }
  }
}
