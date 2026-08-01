import { createHash } from "node:crypto";

export const buildInvoiceKeys = (deliveryNoteIds: string[]) => {
  const sortedIds = [...deliveryNoteIds].sort();
  const idempotencyKey = createHash("sha256")
    .update(`invoice:v1:${sortedIds.join(",")}`)
    .digest("hex");

  return {
    idempotencyKey,
    remoteReference: `EPOX-${idempotencyKey.slice(0, 32)}`
  };
};
