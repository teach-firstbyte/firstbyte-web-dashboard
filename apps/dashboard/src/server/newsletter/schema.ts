import { z } from "zod";

import { SAMPLE_PHOTOS } from "@/lib/newsletter/photos";
import { idParam } from "@/server/validation";

/**
 * A lead's edit of their team's update.
 *
 * Each line says which of the AI's original lines it came from (`from`), not
 * what its sources are. The server copies the sources over from that
 * original line, so a source shown in the newsletter is always one the draft
 * job really collected -- an edit can change the words, never the evidence.
 * A line the lead wrote from scratch has `from: null` and no sources.
 */
export const saveTeamUpdateSchema = z.object({
  updateId: idParam,
  lines: z
    .array(
      z.object({
        text: z
          .string()
          .trim()
          .min(1, "A line can't be empty")
          .max(300, "Keep each line under 300 characters"),
        from: z.number().int().min(0).nullable(),
      }),
    )
    .max(6, "Keep it to 6 lines or fewer"),
  photo: z
    .enum(SAMPLE_PHOTOS.map((p) => p.key) as [string, ...string[]])
    .nullable(),
});

export type SaveTeamUpdateInput = z.infer<typeof saveTeamUpdateSchema>;

export const decideTeamUpdateSchema = z.object({
  updateId: idParam,
  decision: z.enum(["APPROVED", "SKIPPED", "DRAFT"]),
});

export type DecideTeamUpdateInput = z.infer<typeof decideTeamUpdateSchema>;

export const approveIssueSchema = z.object({
  issueId: idParam,
  note: z
    .string()
    .trim()
    .max(300, "Keep the note under 300 characters")
    .nullish()
    .transform((v) => (v ? v : null)),
});

export type ApproveIssueInput = z.infer<typeof approveIssueSchema>;

export const setApproverSchema = z.object({
  userId: idParam,
  approver: z.boolean(),
});
