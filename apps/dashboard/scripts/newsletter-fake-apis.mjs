#!/usr/bin/env node
/**
 * Stand-ins for the two outside services the newsletter calls, for trying it
 * on your own computer with no Claude key and no real email:
 *
 *   POST /v1/messages  Claude's Messages API. Answered by a local Ollama
 *                      model (default), or by canned lines with --canned.
 *   POST /emails       Resend. Nothing is sent: each email is saved as an
 *                      .html file, and http://127.0.0.1:4010/ lists them.
 *
 * Point the dashboard at it in .env.local:
 *
 *   ANTHROPIC_API_KEY=fake
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:4010
 *   RESEND_API_KEY=fake
 *   RESEND_BASE_URL=http://127.0.0.1:4010
 *
 * Run it:  npm run newsletter:fake-apis -w @firstbyte/dashboard
 *          (add -- --canned to skip Ollama)
 *
 * Settings (environment variables):
 *   OLLAMA_URL     default http://127.0.0.1:11434
 *   OLLAMA_MODEL   default qwen2.5:14b
 *   FAKE_PORT      default 4010
 *   OUTBOX_DIR     default <your temp folder>/firstbyte-newsletter-outbox
 *
 * Local testing only. It listens on 127.0.0.1, has no authentication, and
 * must never be the base URL of a deployed environment.
 *
 * Ollama answers in the JSON shape the dashboard asks for, using Ollama's own
 * `format` setting. Ollama's Anthropic-compatible endpoint is not used,
 * because it doesn't support that setting.
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.FAKE_PORT || 4010);
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(
  /\/$/,
  "",
);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:14b";
const OUTBOX =
  process.env.OUTBOX_DIR ||
  path.join(os.tmpdir(), "firstbyte-newsletter-outbox");
const CANNED = process.argv.includes("--canned");

fs.mkdirSync(OUTBOX, { recursive: true });

/** Replaces local "#/$defs/x" references, which some Ollama versions don't follow. */
function inlineRefs(schema) {
  const defs = schema.$defs ?? schema.definitions ?? {};
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    if (typeof node.$ref === "string") {
      const name = node.$ref.split("/").pop();
      return walk(defs[name] ?? {});
    }
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k !== "$defs" && k !== "definitions") out[k] = walk(v);
    }
    return out;
  };
  return walk(schema);
}

/** Anthropic content (a string or text blocks) as plain text. */
function asText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
  }
  return "";
}

function anthropicMessage(model, text, usage = {}) {
  return {
    id: `msg_fake_${Date.now()}`,
    type: "message",
    role: "assistant",
    model,
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: usage.input ?? 0,
      output_tokens: usage.output ?? 0,
    },
  };
}

function anthropicError(res, status, message) {
  res.statusCode = status;
  res.end(
    JSON.stringify({ type: "error", error: { type: "api_error", message } }),
  );
}

/**
 * --canned: one line per kind of item, citing real ids, plus one line citing
 * an id that doesn't exist -- which the dashboard's check step must drop.
 */
function cannedDraft(body) {
  const userText = asText(body.messages?.at(-1)?.content);
  const start = userText.indexOf("[");
  const items = start >= 0 ? JSON.parse(userText.slice(start)) : [];
  const first = (kind) => items.find((i) => i.kind === kind);
  const lines = [];
  const gh = first("github");
  const slack = first("slack");
  const meeting = first("meeting");
  if (gh)
    lines.push({
      text: "The team merged new work this week.",
      sourceIds: [gh.id],
    });
  if (meeting)
    lines.push({
      text: "The team met to keep things moving.",
      sourceIds: [meeting.id],
    });
  if (slack)
    lines.push({
      text: "The team is talking about what to build next.",
      sourceIds: [slack.id],
    });
  lines.push({
    text: "This line cites nothing real and should be dropped.",
    sourceIds: ["made-up-id"],
  });
  return anthropicMessage("fake/canned", JSON.stringify({ lines }));
}

async function ollamaDraft(body) {
  const schema = body.output_config?.format?.schema;
  const system = [
    asText(body.system),
    schema
      ? `Answer with JSON only, matching this JSON schema:\n${JSON.stringify(inlineRefs(schema))}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const messages = [
    { role: "system", content: system },
    ...(body.messages ?? []).map((m) => ({
      role: m.role,
      content: asText(m.content),
    })),
  ];

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      think: false,
      format: schema ? inlineRefs(schema) : undefined,
      options: { temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Ollama answered ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const data = await res.json();
  return anthropicMessage(
    `ollama/${OLLAMA_MODEL}`,
    data.message?.content ?? "",
    {
      input: data.prompt_eval_count,
      output: data.eval_count,
    },
  );
}

/** Saves one email, with its inline photos turned into data: URLs so it opens on its own. */
function saveEmail(body) {
  let html = body.html ?? `<pre>${body.text ?? ""}</pre>`;
  for (const a of body.attachments ?? []) {
    const cid = a.content_id ?? a.contentId;
    if (!cid || !a.content) continue;
    const b64 =
      typeof a.content === "string"
        ? a.content
        : Buffer.from(a.content.data ?? []).toString("base64");
    html = html.replaceAll(
      `cid:${cid}`,
      `data:${a.content_type ?? "image/jpeg"};base64,${b64}`,
    );
  }
  const to = [body.to]
    .flat()
    .join(",")
    .replace(/[^a-z0-9@.,_-]/gi, "_");
  const file = `${new Date().toISOString().replace(/[:.]/g, "-")}_${to}.html`;
  const banner = `<div style="font:13px system-ui;padding:8px 12px;background:#fff3cd">Fake send. From: ${escape(body.from)} · To: ${escape([body.to].flat().join(", "))} · Subject: ${escape(body.subject)}</div>`;
  fs.writeFileSync(path.join(OUTBOX, file), banner + html);
  return file;
}

function escape(s = "") {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function outboxIndex() {
  const files = fs
    .readdirSync(OUTBOX)
    .filter((f) => f.endsWith(".html"))
    .sort()
    .reverse();
  const rows = files
    .map(
      (f) =>
        `<li><a href="/outbox/${encodeURIComponent(f)}">${escape(f)}</a></li>`,
    )
    .join("");
  return `<!doctype html><meta charset="utf-8"><title>Newsletter outbox</title><body style="font:15px system-ui;max-width:760px;margin:40px auto;padding:0 16px"><h1>Newsletter outbox</h1><p>Emails the dashboard "sent" to the fake Resend. Saved in ${escape(OUTBOX)}.</p><ul>${rows || "<li>Nothing yet.</li>"}</ul></body>`;
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    if (req.method === "GET" && url.pathname === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(outboxIndex());
    }
    if (req.method === "GET" && url.pathname.startsWith("/outbox/")) {
      const name = path.basename(
        decodeURIComponent(url.pathname.slice("/outbox/".length)),
      );
      const file = path.join(OUTBOX, name);
      if (!fs.existsSync(file)) {
        res.statusCode = 404;
        return res.end("Not found");
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(fs.readFileSync(file));
    }

    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      res.setHeader("Content-Type", "application/json");
      let body;
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        return anthropicError(res, 400, "Body is not JSON");
      }

      if (req.method === "POST" && url.pathname === "/v1/messages") {
        try {
          const msg = CANNED ? cannedDraft(body) : await ollamaDraft(body);
          console.log(
            `[ai] ${msg.model}: ${msg.content[0].text.slice(0, 160)}`,
          );
          return res.end(JSON.stringify(msg));
        } catch (e) {
          console.error(`[ai] failed: ${e.message}`);
          return anthropicError(
            res,
            500,
            `Fake API couldn't reach Ollama: ${e.message}`,
          );
        }
      }

      if (req.method === "POST" && url.pathname === "/emails") {
        const file = saveEmail(body);
        console.log(`[email] to ${[body.to].flat().join(", ")} -> ${file}`);
        return res.end(JSON.stringify({ id: `email_fake_${Date.now()}` }));
      }

      res.statusCode = 404;
      res.end(
        JSON.stringify({
          error: `The fake APIs don't handle ${req.method} ${url.pathname}`,
        }),
      );
    });
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`Fake newsletter APIs on http://127.0.0.1:${PORT}`);
    console.log(
      CANNED
        ? "AI: canned lines (no Ollama)"
        : `AI: Ollama ${OLLAMA_MODEL} at ${OLLAMA_URL}`,
    );
    console.log(
      `Emails: saved to ${OUTBOX}, listed at http://127.0.0.1:${PORT}/`,
    );
  });
