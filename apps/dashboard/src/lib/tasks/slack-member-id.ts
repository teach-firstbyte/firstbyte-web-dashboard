// Slack member IDs for the FirstByte Tasks bot. Pure, so the Slack setup page
// (client and server) and the DM sender share one rule.
//
// A member ID is what Slack shows under a profile's ⋮ menu → "Copy member ID".
// Regular workspaces use U..., Enterprise Grid uses W.... Slack doesn't promise
// a length, so this allows 8–11 characters after the letter: today's IDs are
// 10 or 11 (the sandbox's are like U0CK0SKF78E).

const MEMBER_ID = /^[UW][A-Z0-9]{8,11}$/;

/** Shown under the input when someone pastes something that isn't an ID. */
export const SLACK_MEMBER_ID_ERROR =
  "That isn't a Slack member ID. Member IDs look like U07ABC1234: in Slack, open their profile, click ⋮, then Copy member ID.";

/** True only for an already-clean ID (no spaces, upper case). */
export function isSlackMemberId(value: string): boolean {
  return MEMBER_ID.test(value);
}

/**
 * Cleans up what a person pasted (surrounding spaces, lower case, a leading
 * "@") and returns the ID, or null if it still isn't one. Store the returned
 * value, not the raw input.
 */
export function normalizeSlackMemberId(input: string): string | null {
  const value = input.trim().replace(/^@/, "").toUpperCase();
  return isSlackMemberId(value) ? value : null;
}
