import rateLimit from "express-rate-limit";
import { secureSecretEquals } from "../security/secureSecretEquals.js";

interface RateLimiterConfig {
  windowMs: number;
  max: number;
}

interface GeneralApiRateLimiterConfig extends RateLimiterConfig {
  hermesSharedSecret: string;
}

const rateLimitResponse = {
  error: "Demasiadas solicitudes. Intentalo de nuevo mas tarde"
} as const;

const commonOptions = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  message: rateLimitResponse
};

export const buildGeneralApiRateLimiter = ({
  windowMs,
  max,
  hermesSharedSecret
}: GeneralApiRateLimiterConfig) =>
  rateLimit({
    ...commonOptions,
    windowMs,
    limit: max,
    skip: (request) => {
      const suppliedSecret =
        request.header("x-hermes-secret") ??
        request.header("x-epoxiron-hermes-secret");

      return secureSecretEquals(suppliedSecret, hermesSharedSecret);
    }
  });

export const buildLoginRateLimiter = ({ windowMs, max }: RateLimiterConfig) =>
  rateLimit({
    ...commonOptions,
    windowMs,
    limit: max
  });
