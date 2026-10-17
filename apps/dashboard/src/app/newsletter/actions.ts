"use server";

import { revalidatePath } from "next/cache";

import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { isOfficer } from "@/lib/auth/roles";
import {
  canRunJobsByHand,
  isNewsletterEnabled,
} from "@/lib/newsletter/enabled";
import { publicOrigin } from "@/lib/publicOrigin";
import { type ActionResult, toActionError } from "@/server/errors";
import { parseOrThrow } from "@/server/http";
import { runDraftJob, sendIssue } from "@/server/newsletter/jobs";
import {
  approveIssue,
  decideTeamUpdate,
  deleteIssue,
  dismissHomeCard,
  recordRead,
  saveTeamUpdate,
  setNewsletterApprover,
  setNewsletterOptOut,
  withdrawApproval,
} from "@/server/newsletter/mutations";
import {
  approveIssueSchema,
  decideTeamUpdateSchema,
  saveTeamUpdateSchema,
  setApproverSchema,
} from "@/server/newsletter/schema";
import { idParam } from "@/server/validation";

// Every action here ends with the same refresh: the hub, the issue and the
// editor all show the same statuses.
function refresh() {
  revalidatePath("/newsletter", "layout");
}

async function gate() {
  const user = await requireApprovedUser();
  if (!isNewsletterEnabled()) throw new Error("The newsletter is off");
  return user;
}

export async function saveTeamUpdateAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await gate();
  try {
    await saveTeamUpdate(user, parseOrThrow(saveTeamUpdateSchema, input));
  } catch (e) {
    return toActionError(e, "saveTeamUpdate", "Couldn't save the update");
  }
  refresh();
  return { success: true };
}

export async function decideTeamUpdateAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await gate();
  try {
    await decideTeamUpdate(user, parseOrThrow(decideTeamUpdateSchema, input));
  } catch (e) {
    return toActionError(e, "decideTeamUpdate", "Couldn't save that");
  }
  refresh();
  return { success: true };
}

export async function approveIssueAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await gate();
  try {
    await approveIssue(user, parseOrThrow(approveIssueSchema, input));
  } catch (e) {
    return toActionError(e, "approveIssue", "Couldn't approve the issue");
  }
  refresh();
  return { success: true };
}

export async function withdrawApprovalAction(
  issueId: number,
): Promise<ActionResult> {
  const user = await gate();
  try {
    await withdrawApproval(user, parseOrThrow(idParam, issueId));
  } catch (e) {
    return toActionError(e, "withdrawApproval", "Couldn't change the approval");
  }
  refresh();
  return { success: true };
}

export async function setApproverAction(input: unknown): Promise<ActionResult> {
  const user = await gate();
  try {
    const { userId, approver } = parseOrThrow(setApproverSchema, input);
    await setNewsletterApprover(user, userId, approver);
  } catch (e) {
    return toActionError(e, "setNewsletterApprover", "Couldn't save that");
  }
  refresh();
  return { success: true };
}

export async function recordReadAction(
  issueId: number,
  via: "email" | "dashboard",
): Promise<void> {
  const user = await gate();
  // Best effort: a missed count must never get in the way of reading.
  await recordRead(
    user,
    parseOrThrow(idParam, issueId),
    via === "email" ? "email" : "dashboard",
  ).catch((e) => console.error("recordRead failed:", e));
  revalidatePath("/");
}

export async function dismissHomeCardAction(
  issueId: number,
): Promise<ActionResult> {
  const user = await gate();
  try {
    await dismissHomeCard(user, parseOrThrow(idParam, issueId));
  } catch (e) {
    return toActionError(e, "dismissHomeCard", "Couldn't hide that");
  }
  revalidatePath("/");
  return { success: true };
}

export async function setOptOutAction(optOut: boolean): Promise<ActionResult> {
  const user = await gate();
  try {
    await setNewsletterOptOut(user, optOut === true);
  } catch (e) {
    return toActionError(e, "setNewsletterOptOut", "Couldn't save that");
  }
  refresh();
  return { success: true };
}

// ---------------------------------------------------------------------------
// By-hand jobs. Preview and local development only (canRunJobsByHand), and
// officers only. In production the schedule runs them.
// ---------------------------------------------------------------------------

async function gateJobs() {
  const user = await gate();
  if (!isOfficer(user) || !canRunJobsByHand()) {
    throw new Error("Running jobs by hand is for officers on a preview only");
  }
  return user;
}

export type JobResult = ActionResult & { message?: string };

export async function runDraftJobAction(): Promise<JobResult> {
  await gateJobs();
  try {
    const r = await runDraftJob(new Date());
    refresh();
    const failed = r.failed.length
      ? ` The AI couldn't draft for ${r.failed.join(", ")}.`
      : "";
    return {
      success: true,
      message: `Drafted ${r.drafted} team update${r.drafted === 1 ? "" : "s"} with ${r.kept} line${r.kept === 1 ? "" : "s"} in total.${failed}`,
    };
  } catch (e) {
    return toActionError(e, "runDraftJob", "The draft job failed");
  }
}

export async function sendIssueAction(issueId: number): Promise<JobResult> {
  await gateJobs();
  try {
    const r = await sendIssue(
      parseOrThrow(idParam, issueId),
      await publicOrigin(),
      new Date(),
    );
    refresh();
    revalidatePath("/");
    const failed = r.failed.length ? ` ${r.failed.length} failed.` : "";
    const one = r.sent === 1;
    const who = r.toMembers
      ? one
        ? "member"
        : "members"
      : one
        ? "test address"
        : "test addresses";
    return { success: true, message: `Sent to ${r.sent} ${who}.${failed}` };
  } catch (e) {
    return toActionError(e, "sendIssue", "Sending failed");
  }
}

export async function deleteIssueAction(issueId: number): Promise<JobResult> {
  await gateJobs();
  try {
    await deleteIssue(parseOrThrow(idParam, issueId));
  } catch (e) {
    return toActionError(e, "deleteIssue", "Couldn't delete the issue");
  }
  refresh();
  revalidatePath("/");
  return {
    success: true,
    message: "Deleted. Run the draft job to start over.",
  };
}
