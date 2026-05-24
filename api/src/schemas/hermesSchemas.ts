import { z } from "zod";

export const hermesMessageSchema = z.object({
  content: z.string().min(1)
});

export const hermesExecuteActionSchema = z.object({
  toolName: z.string().min(1),
  parameters: z.record(z.unknown())
});

