import { z } from "zod";
import { nullableText } from "@/server/validation";

const name = z
  .string({ error: "name is required" })
  .trim()
  .min(1, "name is required");

export const createTeamSchema = z.object({
  name,
  description: nullableText,
  // isActive defaults to true in the schema; the default here keeps the two in
  // step so a create with no flag behaves the same either way.
  isActive: z.boolean().default(true),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z
  .object({ name, description: nullableText, isActive: z.boolean() })
  .partial()
  .refine(
    (v) => Object.keys(v).length > 0,
    "Provide at least one of: name, description, isActive",
  );

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
