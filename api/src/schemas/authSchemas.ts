import { z } from "zod";

export const googleLoginSchema = z.object({
  credential: z.string().trim().min(1)
});
