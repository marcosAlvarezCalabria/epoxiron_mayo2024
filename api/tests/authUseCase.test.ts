import { describe, expect, it, vi } from "vitest";
import { DomainException } from "../src/domain/exceptions/DomainException.js";
import {
  AuthenticateWithGoogleUseCase,
  type AccessTokenIssuer,
  type GoogleIdentityVerifier
} from "../src/application/use-cases/auth.js";

describe("AuthenticateWithGoogleUseCase", () => {
  it("issues a JWT for an allowed email", async () => {
    const verifier: GoogleIdentityVerifier = {
      verifyIdToken: vi.fn().mockResolvedValue({
        email: "allowed@example.com",
        name: "Allowed User"
      })
    };
    const issuer: AccessTokenIssuer = {
      issue: vi.fn().mockReturnValue("signed-jwt")
    };
    const useCase = new AuthenticateWithGoogleUseCase(verifier, issuer, [
      "allowed@example.com"
    ]);

    const result = await useCase.execute({ credential: "google-token" });

    expect(result).toEqual({
      token: "signed-jwt",
      user: {
        email: "allowed@example.com",
        name: "Allowed User"
      }
    });
    expect(verifier.verifyIdToken).toHaveBeenCalledWith("google-token");
    expect(issuer.issue).toHaveBeenCalledWith({
      email: "allowed@example.com",
      name: "Allowed User"
    });
  });

  it("rejects a valid Google identity outside the allowlist", async () => {
    const verifier: GoogleIdentityVerifier = {
      verifyIdToken: vi.fn().mockResolvedValue({
        email: "blocked@example.com",
        name: "Blocked User"
      })
    };
    const issuer: AccessTokenIssuer = {
      issue: vi.fn()
    };
    const useCase = new AuthenticateWithGoogleUseCase(verifier, issuer, [
      "allowed@example.com"
    ]);

    await expect(useCase.execute({ credential: "google-token" })).rejects.toEqual(
      new DomainException("Email no autorizado", 403)
    );
    expect(issuer.issue).not.toHaveBeenCalled();
  });
});
