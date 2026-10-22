import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

import { formatLongDateTime } from "@/lib/format";
import type { UpcomingEvent, UpdateLine } from "@/types/newsletter";
import { samplePhotoFile } from "./photos";
import { formatWeekOf } from "./week";

export type EmailTeam = {
  name: string;
  lines: UpdateLine[];
  photo: string | null;
};

export type EmailIssue = {
  id: number;
  weekOf: Date;
  note: string | null;
  teams: EmailTeam[];
  upcoming: UpcomingEvent[];
};

/** Escapes text for HTML. Every value that reaches the template goes through it. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The dashboard's colors, written out because email clients can't read CSS
// variables. Light theme only: most email apps ignore dark-mode CSS anyway.
const C = {
  page: "#f8f4ec",
  card: "#ffffff",
  text: "#1c1b22",
  muted: "#6b6a75",
  border: "#e9e3d6",
  green: "#25803f",
};

/**
 * The newsletter email. Plain table layout and inline styles, because that is
 * what email apps render reliably. Photos are inline attachments referenced by
 * cid:, so they are inside the email itself and never need a public link.
 */
export function renderIssueHtml(
  issue: EmailIssue,
  links: {
    issue: string;
    meetings: string;
    unsubscribe: string;
  },
): string {
  const upcoming = issue.upcoming.length
    ? issue.upcoming
        .map(
          (e) => `
      <tr><td style="padding:10px 0;border-top:1px solid ${C.border}">
        <div style="font-weight:600;font-size:15px">${esc(e.title)}</div>
        <div style="color:${C.muted};font-size:13px">${esc(
          [
            formatLongDateTime(e.scheduledAt),
            e.location,
            e.isRequired ? "Required" : null,
          ]
            .filter(Boolean)
            .join(" · "),
        )}</div>
      </td></tr>`,
        )
        .join("")
    : `<tr><td style="padding:10px 0;color:${C.muted};font-size:14px">Nothing on the calendar for the next two weeks yet.</td></tr>`;

  const teams = issue.teams
    .map((t) => {
      const lines = t.lines
        .map((l) => `<li style="margin:4px 0">${esc(l.text)}</li>`)
        .join("");
      const photo = t.photo
        ? `<img src="cid:${esc(t.photo)}" alt="" width="552" style="display:block;width:100%;max-width:552px;height:auto;border-radius:10px;margin-top:10px">`
        : "";
      return `
      <tr><td style="padding:12px 0;border-top:1px solid ${C.border}">
        <div style="font-weight:600;font-size:15px;margin-bottom:4px">${esc(t.name)}</div>
        <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.5">${lines}</ul>
        ${photo}
      </td></tr>`;
    })
    .join("");

  const note = issue.note
    ? `<p style="margin:12px 0 0;font-size:14px">${esc(issue.note)}</p>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>This week at FirstByte</title></head>
<body style="margin:0;padding:0;background:${C.page};color:${C.text};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.border};border-radius:16px">
  <tr><td style="padding:24px 24px 8px">
    <div style="font-family:Menlo,Consolas,monospace;font-size:12px;color:${C.green}">$ firstbyte --this-week</div>
    <h1 style="margin:6px 0 4px;font-size:24px">This week at FirstByte</h1>
    <div style="color:${C.muted};font-size:14px">Week of ${esc(formatWeekOf(issue.weekOf))}</div>
    ${note}
  </td></tr>
  <tr><td style="padding:8px 24px 4px">
    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};margin:12px 0 4px">Coming up</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${upcoming}</table>
    <p style="margin:8px 0 0;font-size:14px"><a href="${esc(links.meetings)}" style="color:${C.green};font-weight:600;text-decoration:none">See meetings on the dashboard →</a></p>
  </td></tr>
  <tr><td style="padding:8px 24px 20px">
    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};margin:12px 0 4px">What the teams are up to</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${teams}</table>
    <p style="margin:12px 0 0;font-size:14px"><a href="${esc(links.issue)}" style="color:${C.green};font-weight:600;text-decoration:none">Read it on the dashboard →</a></p>
  </td></tr>
  <tr><td style="padding:14px 24px;border-top:1px solid ${C.border};font-size:12px;color:${C.muted}">
    FirstByte · CS &amp; STEM education. Team updates are drafted with AI and checked by each team's lead.
    <a href="${esc(links.unsubscribe)}" style="color:${C.green}">Unsubscribe</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

/** The plain-text part, for email apps that show text only. */
export function renderIssueText(
  issue: EmailIssue,
  links: {
    issue: string;
    unsubscribe: string;
  },
): string {
  const upcoming = issue.upcoming.length
    ? issue.upcoming
        .map((e) => `- ${e.title}, ${formatLongDateTime(e.scheduledAt)}`)
        .join("\n")
    : "Nothing on the calendar for the next two weeks yet.";
  const teams = issue.teams
    .map((t) => `${t.name}\n${t.lines.map((l) => `- ${l.text}`).join("\n")}`)
    .join("\n\n");
  return [
    "This week at FirstByte",
    issue.note ?? "",
    "COMING UP",
    upcoming,
    "WHAT THE TEAMS ARE UP TO",
    teams,
    `Read it on the dashboard: ${links.issue}`,
    `Unsubscribe: ${links.unsubscribe}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Reads a sample photo from public/newsletter-samples/. next.config.ts traces
 * that folder into the newsletter's server functions, so the file exists on
 * Vercel as well as locally.
 */
async function readSamplePhoto(key: string): Promise<Buffer | null> {
  const file = samplePhotoFile(key);
  if (!file) return null;
  return readFile(
    path.join(process.cwd(), "public", "newsletter-samples", file),
  ).catch(() => null);
}

export type SendResult = { sent: number; failed: string[] };

/**
 * Sends one email per recipient. One at a time rather than Resend's batch
 * endpoint, because the batch endpoint doesn't support attachments, and the
 * photos are attachments. At about 60 members that's fine.
 */
export async function sendIssueEmails(
  issue: EmailIssue,
  recipients: string[],
  links: { issue: string; meetings: string; unsubscribe: string },
): Promise<SendResult | { error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM;
  if (!apiKey) return { error: "Email isn't set up yet (no RESEND_API_KEY)." };
  if (!from) return { error: "Email isn't set up yet (no NEWSLETTER_FROM)." };

  const photoKeys = [
    ...new Set(issue.teams.flatMap((t) => (t.photo ? [t.photo] : []))),
  ];
  const attachments = (
    await Promise.all(
      photoKeys.map(async (key) => {
        const content = await readSamplePhoto(key);
        return content
          ? {
              filename: `${key}.jpg`,
              // Base64, not the Buffer: the SDK JSON-encodes a Buffer as
              // {type: "Buffer", data: [...]}, while a base64 string is the
              // documented shape of the API.
              content: content.toString("base64"),
              contentType: "image/jpeg",
              contentId: key,
            }
          : null;
      }),
    )
  ).filter((a) => a !== null);
  // A photo that couldn't be read is left out of the email, not shown broken.
  const withPhotos: EmailIssue = {
    ...issue,
    teams: issue.teams.map((t) => ({
      ...t,
      photo:
        t.photo && attachments.some((a) => a.contentId === t.photo)
          ? t.photo
          : null,
    })),
  };

  const html = renderIssueHtml(withPhotos, links);
  const text = renderIssueText(withPhotos, links);
  const resend = new Resend(apiKey);
  const result: SendResult = { sent: 0, failed: [] };

  for (const to of recipients) {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `This week at FirstByte · ${formatWeekOf(issue.weekOf)}`,
      html,
      text,
      attachments,
      headers: { "List-Unsubscribe": `<${links.unsubscribe}>` },
    });
    if (error) {
      console.error("newsletter email failed:", to, error.message);
      result.failed.push(to);
    } else {
      result.sent++;
    }
  }
  return result;
}
