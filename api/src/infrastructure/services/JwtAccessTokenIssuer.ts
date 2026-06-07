import { createHmac, timingSafeEqual } from "node:crypto";
import type { AccessTokenIssuer, AuthenticatedUser } from "../../application/use-cases/auth.js";

interface JwtPayload extends AuthenticatedUser {
  exp: number;
  iat: number;
}

const base64UrlEncode = (input: string) =>
  Buffer.from(input, "utf8").toString("base64url");

const base64UrlDecode = (input: string) =>
  Buffer.from(input, "base64url").toString("utf8");

const parseExpiresInToSeconds = (value: string) => {
  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    throw new Error(`JWT_EXPIRES_IN invalido: ${value}`);
  }

  const amount = Number.parseInt(match[1], 10);
  const unitMultiplier = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  } as const;
  const unit = match[2].toLowerCase() as keyof typeof unitMultiplier;

  return amount * unitMultiplier[unit];
};

export class JwtAccessTokenIssuer implements AccessTokenIssuer {
  private readonly expiresInSeconds: number;

  public constructor(
    private readonly secret: string,
    private readonly expiresIn: string
  ) {
    this.expiresInSeconds = parseExpiresInToSeconds(expiresIn);
  }

  public issue(user: AuthenticatedUser): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      ...user,
      iat: issuedAt,
      exp: issuedAt + this.expiresInSeconds
    };
    const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  public verify(token: string): JwtPayload {
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new Error("Token incompleto");
    }

    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);
    const providedSignature = Buffer.from(signature, "base64url");
    const computedSignature = Buffer.from(expectedSignature, "base64url");

    if (
      providedSignature.length !== computedSignature.length ||
      !timingSafeEqual(providedSignature, computedSignature)
    ) {
      throw new Error("Firma invalida");
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.exp !== "number" || payload.exp <= now) {
      throw new Error("Token expirado");
    }

    return payload;
  }

  private sign(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }
}
