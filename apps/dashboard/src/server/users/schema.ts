import { AccountStatus } from "@prisma/client";
import { z } from "zod";
import { OFFICER_ROLES } from "@/lib/auth/roles";
import { boundedText, gradYear } from "@/server/onboarding/schema";
import { nullableText } from "@/server/validation";

/**
 * Email is stored and compared as given. Normalizing case would be a real
 * improvement, but it would also silently merge existing rows that differ only
 * by case, so it belongs in its own change with a migration.
 */
const email = z
  .string({ error: "Email and name are required" })
  .trim()
  .min(1, "Email and name are required")
  .email("That is not a valid email address");

export const createUserSchema = z.object({
  email,
  name: z
    .string({ error: "Email and name are required" })
    .trim()
    .min(1, "Email and name are required"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({ email, name: nullableText })
  .partial()
  .refine(
    (v) => Object.keys(v).length > 0,
    "Provide at least one of: name, email",
  );

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * The Settings page's own profile fields. Reuses onboarding's bounds
 * (100-char cap, grad year within 10 years of now) so the two forms can never
 * silently drift apart on what counts as valid.
 */
export const updateProfileSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1, "Name cannot be empty"),
  ),
  preferredName: boundedText("preferred name"),
  pronouns: boundedText("pronouns"),
  gradYear,
  major: boundedText("major"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * The statuses an officer may set. Not DELETED: only deleteOwnAccount writes
 * that, because it also clears the personal fields. Setting it by hand would
 * hide a person while keeping all of their data.
 */
const DECIDABLE_STATUSES = Object.values(AccountStatus).filter(
  (s) => s !== AccountStatus.DELETED,
);

const decidableStatus = z.enum(DECIDABLE_STATUSES, {
  error: `Invalid status. Must be one of: ${DECIDABLE_STATUSES.join(", ")}`,
});

export const accountStatusSchema = z.object({ status: decidableStatus });

export const bulkAccountStatusSchema = z.object({
  userIds: z
    .array(z.number().int().positive())
    .min(1, "Select at least one account"),
  status: decidableStatus,
});

export type BulkAccountStatusInput = z.infer<typeof bulkAccountStatusSchema>;

/** The Settings "Delete account" form: the email, typed again to confirm. */
export const deleteAccountSchema = z.object({
  confirmEmail: z
    .string({ error: "Type your email to confirm" })
    .trim()
    .min(1, "Type your email to confirm"),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/**
 * The Members panel's promote request. Only roles someone can be promoted to,
 * which are the officer roles: NORTHEASTERN_STUDENT is never a promotion.
 * Whether this role is allowed for this person is promoteUser's job.
 */
export const promoteUserSchema = z.object({
  role: z.enum(OFFICER_ROLES, {
    error: `Invalid role. Must be one of: ${OFFICER_ROLES.join(", ")}`,
  }),
});
