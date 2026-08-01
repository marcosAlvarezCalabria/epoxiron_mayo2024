import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: resolve(process.cwd(), "..", ".env") });

const optionalId = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional()
);

const schema = z.object({
  ODOO_URL: z.string().url().transform((value) => value.replace(/\/+$/, "")),
  ODOO_DB: z.string().min(1),
  ODOO_USER: z.string().min(1),
  ODOO_API_KEY: z.string().min(1),
  ODOO_TEST_PARTNER_ID: optionalId,
  ODOO_TEST_TAX_RATE: z.coerce.number().positive().default(21),
  ODOO_TEST_UNIT_PRICE: z.coerce.number().positive().default(100),
  ODOO_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  ODOO_POLL_ATTEMPTS: z.coerce.number().int().positive().max(120).default(12),
  SPIKE_ALLOW_WRITES: z.enum(["true", "false"]).default("false").transform((v) => v === "true")
});

export type SpikeConfig = z.infer<typeof schema>;
export const getConfig = (): SpikeConfig => schema.parse(process.env);

