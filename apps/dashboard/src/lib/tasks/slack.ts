import "server-only";

import { isSlackMemberId } from "./slack-member-id.ts";
import type { SlackMessage } from "./slack-messages.ts";

// Sends direct messages from the FirstByte Tasks bot (slack-tasks-app/).
//
// This is NOT the newsletter's Slack bot and doesn't share its token: it reads
// TASKS_SLACK_BOT_TOKEN only. Every reminder is a DM. Nothing here can post in
// a channel, because it only ever opens a DM with one member ID.
//
// sendSlackDm() never throws. It resolves to { ok: true } or { ok: false,
// error }, so the reminder job (#138) can record a failed send, retry it
// hourly, and show "Reminder not delivered" after a day.

const SLACK_API = "https://slack.com/api";
const TIMEOUT_MS = 10_000;

export type SlackDmResult =
  | { ok: true; channel: string; ts: string }
  | {
      ok: false;
      /**
       * Slack's own error code (channel_not_found, user_not_found,
       * invalid_auth, missing_scope, ratelimited, ...) or one of ours:
       * - not_configured: TASKS_SLACK_BOT_TOKEN isn't set, nothing was sent
       * - invalid_member_id: the ID doesn't look like a Slack member ID
       * - http_<status>: Slack answered with a non-JSON error page
       * - network_error / timeout: Slack couldn't be reached
       */
      error: string;
      /** Worth trying again later (Slack down, rate limited, timed out). */
      retryable: boolean;
      /** From Slack's Retry-After header when it rate limits us. */
      retryAfterSeconds?: number;
    };

export type SendSlackDmOptions = {
  /** Defaults to process.env.TASKS_SLACK_BOT_TOKEN. */
  token?: string;
  /** For tests. Defaults to the global fetch. */
  fetch?: typeof fetch;
};

// Errors where trying again later can succeed. Everything else (bad token,
// missing scope, deactivated user) needs a person to fix something first.
const RETRYABLE = new Set([
  "ratelimited",
  "rate_limited",
  "internal_error",
  "fatal_error",
  "service_unavailable",
  "request_timeout",
  "timeout",
  "network_error",
]);

function failure(
  error: string,
  retryAfterSeconds?: number,
): Extract<SlackDmResult, { ok: false }> {
  const retryable = RETRYABLE.has(error) || /^http_5\d\d$/.test(error);
  return retryAfterSeconds === undefined
    ? { ok: false, error, retryable }
    : { ok: false, error, retryable, retryAfterSeconds };
}

type SlackCall =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; result: Extract<SlackDmResult, { ok: false }> };

async function callSlack(
  method: string,
  payload: Record<string, unknown>,
  token: string,
  doFetch: typeof fetch,
): Promise<SlackCall> {
  let res: Response;
  try {
    res = await doFetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const error =
      name === "TimeoutError" || name === "AbortError"
        ? "timeout"
        : "network_error";
    return { ok: false, result: failure(error) };
  }

  if (res.status === 429) {
    const header = Number(res.headers.get("retry-after"));
    return {
      ok: false,
      result: failure(
        "ratelimited",
        Number.isFinite(header) && header > 0 ? header : undefined,
      ),
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, result: failure(`http_${res.status}`) };
  }
  if (typeof body !== "object" || body === null) {
    return { ok: false, result: failure(`http_${res.status}`) };
  }
  const data = body as Record<string, unknown>;
  if (data.ok !== true) {
    const error = typeof data.error === "string" ? data.error : "unknown_error";
    return { ok: false, result: failure(error) };
  }
  return { ok: true, body: data };
}

/**
 * DMs one Slack member as the FirstByte Tasks bot: conversations.open, then
 * chat.postMessage in that DM. Resolves, never rejects.
 *
 * Without a token it logs and sends nothing ({ ok: false, error:
 * "not_configured" }), so local runs without Slack keep working.
 */
export async function sendSlackDm(
  memberId: string,
  message: SlackMessage,
  options: SendSlackDmOptions = {},
): Promise<SlackDmResult> {
  try {
    const token = options.token ?? process.env.TASKS_SLACK_BOT_TOKEN;
    if (!token) {
      console.info(
        `[tasks/slack] TASKS_SLACK_BOT_TOKEN isn't set, so this DM to ${memberId} wasn't sent.`,
      );
      return failure("not_configured");
    }
    if (!isSlackMemberId(memberId)) {
      return failure("invalid_member_id");
    }
    const doFetch = options.fetch ?? fetch;

    const opened = await callSlack(
      "conversations.open",
      { users: memberId },
      token,
      doFetch,
    );
    if (!opened.ok) return opened.result;
    const channelInfo = opened.body.channel as { id?: unknown } | undefined;
    const channel = typeof channelInfo?.id === "string" ? channelInfo.id : null;
    if (!channel) return failure("no_channel_returned");

    const posted = await callSlack(
      "chat.postMessage",
      {
        channel,
        text: message.text,
        unfurl_links: false,
        unfurl_media: false,
      },
      token,
      doFetch,
    );
    if (!posted.ok) return posted.result;
    const ts = typeof posted.body.ts === "string" ? posted.body.ts : "";
    return { ok: true, channel, ts };
  } catch (err) {
    // Belt and braces: nothing above should throw, but a reminder job must
    // never crash on one bad send.
    console.error("[tasks/slack] Unexpected error sending a DM", err);
    return failure("unexpected_error");
  }
}
