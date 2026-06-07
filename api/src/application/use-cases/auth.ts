import { DomainException } from "../../domain/exceptions/DomainException.js";

export interface GoogleIdentity {
  email: string;
  name?: string | null;
}

export interface GoogleIdentityVerifier {
  verifyIdToken(credential: string): Promise<GoogleIdentity>;
}

export interface AuthenticatedUser {
  email: string;
  name: string;
}

export interface AccessTokenIssuer {
  issue(user: AuthenticatedUser): string;
}

interface AuthenticateWithGoogleInput {
  credential: string;
}

interface AuthenticateWithGoogleResult {
  token: string;
  user: AuthenticatedUser;
}

export class AuthenticateWithGoogleUseCase {
  private readonly allowedEmails: Set<string>;

  public constructor(
    private readonly identityVerifier: GoogleIdentityVerifier,
    private readonly accessTokenIssuer: AccessTokenIssuer,
    allowedEmails: string[]
  ) {
    this.allowedEmails = new Set(
      allowedEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)
    );
  }

  public async execute(
    input: AuthenticateWithGoogleInput
  ): Promise<AuthenticateWithGoogleResult> {
    if (!input.credential.trim()) {
      throw new DomainException("credential requerido", 400);
    }

    const identity = await this.identityVerifier.verifyIdToken(input.credential);
    const normalizedEmail = identity.email.trim().toLowerCase();

    if (!this.allowedEmails.has(normalizedEmail)) {
      throw new DomainException("Email no autorizado", 403);
    }

    const user: AuthenticatedUser = {
      email: normalizedEmail,
      name: identity.name?.trim() || normalizedEmail
    };

    return {
      token: this.accessTokenIssuer.issue(user),
      user
    };
  }
}
