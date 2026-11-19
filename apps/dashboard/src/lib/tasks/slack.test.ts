// Runs with --conditions=react-server (see the "test" script) so that
// `import "server-only"` resolves to its empty build instead of throwing.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { sendSlackDm } from "./slack.ts";

const MAYA = "U0CK0SKF78E";
const TOKEN = "xoxb-test-not-a-real-token";
const MESSAGE = { text: "*Book Curry 340* is due today." };

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

function fakeFetch(responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const impl = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      init: init ?? {},
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    const next = responses.shift();
    if (!next) throw new Error("fakeFetch: no response left");
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, fetch: impl as typeof fetch };
}

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const savedToken = process.env.TASKS_SLACK_BOT_TOKEN;
const savedInfo = console.info;
let infoLines: string[] = [];
beforeEach(() => {
  delete process.env.TASKS_SLACK_BOT_TOKEN;
  infoLines = [];
  console.info = (...args: unknown[]) => void infoLines.push(args.join(" "));
});
afterEach(() => {
  if (savedToken === undefined) delete process.env.TASKS_SLACK_BOT_TOKEN;
  else process.env.TASKS_SLACK_BOT_TOKEN = savedToken;
  console.info = savedInfo;
});

test("opens a DM, then posts in it", async () => {
  const { calls, fetch } = fakeFetch([
    json({ ok: true, channel: { id: "D0TASKS01" } }),
    json({ ok: true, channel: "D0TASKS01", ts: "1763460000.000100" }),
  ]);
  const result = await sendSlackDm(MAYA, MESSAGE, { token: TOKEN, fetch });

  assert.deepEqual(result, {
    ok: true,
    channel: "D0TASKS01",
    ts: "1763460000.000100",
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://slack.com/api/conversations.open");
  assert.deepEqual(calls[0].body, { users: MAYA });
  assert.equal(calls[1].url, "https://slack.com/api/chat.postMessage");
  assert.deepEqual(calls[1].body, {
    channel: "D0TASKS01",
    text: MESSAGE.text,
    unfurl_links: false,
    unfurl_media: false,
  });
  for (const call of calls) {
    assert.equal(call.init.method, "POST");
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Bearer ${TOKEN}`);
    assert.match(headers["Content-Type"], /^application\/json/);
  }
});

test("reads TASKS_SLACK_BOT_TOKEN, never the newsletter's SLACK_BOT_TOKEN", async () => {
  process.env.SLACK_BOT_TOKEN = "xoxb-newsletter";
  try {
    const { calls, fetch } = fakeFetch([]);
    const missing = await sendSlackDm(MAYA, MESSAGE, { fetch });
    assert.deepEqual(missing, {
      ok: false,
      error: "not_configured",
      retryable: false,
    });
    assert.equal(calls.length, 0);
    assert.match(infoLines.join("\n"), /TASKS_SLACK_BOT_TOKEN isn't set/);

    process.env.TASKS_SLACK_BOT_TOKEN = "xoxb-tasks";
    const ok = fakeFetch([
      json({ ok: true, channel: { id: "D1" } }),
      json({ ok: true, ts: "1.2" }),
    ]);
    await sendSlackDm(MAYA, MESSAGE, { fetch: ok.fetch });
    const headers = ok.calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer xoxb-tasks");
  } finally {
    delete process.env.SLACK_BOT_TOKEN;
  }
});

test("refuses a bad member ID without calling Slack", async () => {
  const { calls, fetch } = fakeFetch([]);
  const result = await sendSlackDm("C0CHANNEL01", MESSAGE, {
    token: TOKEN,
    fetch,
  });
  assert.deepEqual(result, {
    ok: false,
    error: "invalid_member_id",
    retryable: false,
  });
  assert.equal(calls.length, 0);
});

test("passes Slack's error through when the DM can't be opened", async () => {
  const { calls, fetch } = fakeFetch([
    json({ ok: false, error: "user_not_found" }),
  ]);
  const result = await sendSlackDm(MAYA, MESSAGE, { token: TOKEN, fetch });
  assert.deepEqual(result, {
    ok: false,
    error: "user_not_found",
    retryable: false,
  });
  assert.equal(calls.length, 1, "doesn't try to post");
});

test("passes Slack's error through when posting fails", async () => {
  const { fetch } = fakeFetch([
    json({ ok: true, channel: { id: "D1" } }),
    json({ ok: false, error: "missing_scope" }),
  ]);
  const result = await sendSlackDm(MAYA, MESSAGE, { token: TOKEN, fetch });
  assert.deepEqual(result, {
    ok: false,
    error: "missing_scope",
    retryable: false,
  });
});

test("rate limiting is retryable and carries Retry-After", async () => {
  const { fetch } = fakeFetch([
    json({ ok: false, error: "ratelimited" }, 429, { "retry-after": "30" }),
  ]);
  const result = await sendSlackDm(MAYA, MESSAGE, { token: TOKEN, fetch });
  assert.deepEqual(result, {
    ok: false,
    error: "ratelimited",
    retryable: true,
    retryAfterSeconds: 30,
  });
});

test("a Slack outage page is retryable", async () => {
  const { fetch } = fakeFetch([
    new Response("<html>Bad gateway</html>", { status: 502 }),
  ]);
  const result = await sendSlackDm(MAYA, MESSAGE, { token: TOKEN, fetch });
  assert.deepEqual(result, { ok: false, error: "http_502", retryable: true });
});

test("network errors and timeouts resolve instead of throwing", async () => {
  const offline = fakeFetch([new TypeError("fetch failed")]);
  assert.deepEqual(
    await sendSlackDm(MAYA, MESSAGE, { token: TOKEN, fetch: offline.fetch }),
    {
      ok: false,
      error: "network_error",
      retryable: true,
    },
  );

  const timeout = new DOMException("The operation timed out.", "TimeoutError");
  const slow = fakeFetch([timeout]);
  assert.deepEqual(
    await sendSlackDm(MAYA, MESSAGE, { token: TOKEN, fetch: slow.fetch }),
    {
      ok: false,
      error: "timeout",
      retryable: true,
    },
  );
});

test("a malformed success still resolves", async () => {
  const { fetch } = fakeFetch([json({ ok: true })]);
  const result = await sendSlackDm(MAYA, MESSAGE, { token: TOKEN, fetch });
  assert.deepEqual(result, {
    ok: false,
    error: "no_channel_returned",
    retryable: false,
  });
});
