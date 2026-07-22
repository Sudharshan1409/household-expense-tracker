import { z } from "zod";

export const expenseSchema = z.object({
  amountMinor: z.number().int().positive(),
  currency: z.string().min(3).max(3),
});
