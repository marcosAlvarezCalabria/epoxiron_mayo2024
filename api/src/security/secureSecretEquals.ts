import { timingSafeEqual } from "node:crypto";

export const secureSecretEquals = (
  suppliedSecret: string | undefined,
  expectedSecret: string
): boolean => {
  if (suppliedSecret === undefined) {
    return false;
  }

  const suppliedBuffer = Buffer.from(suppliedSecret, "utf8");
  const expectedBuffer = Buffer.from(expectedSecret, "utf8");

  if (suppliedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(suppliedBuffer, expectedBuffer);
};
