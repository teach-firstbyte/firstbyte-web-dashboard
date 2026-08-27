import { TeamJoinPolicy } from "@prisma/client";
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

// joinPolicy is here but NOT on createTeamSchema. A new team is OPEN by the
// database default; restricting one is a deliberate follow-up edit, which keeps
// createTeam free of any authorization argument.
export const updateTeamSchema = z
  .object({
    name,
    description: nullableText,
    isActive: z.boolean(),
    joinPolicy: z.enum(TeamJoinPolicy),
  })
  .partial()
  .refine(
    (v) => Object.keys(v).length > 0,
    "Provide at least one of: name, description, isActive, joinPolicy",
  );

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
