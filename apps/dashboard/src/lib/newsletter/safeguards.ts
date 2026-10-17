import type { DraftChecks, SourceRef, UpdateLine } from "@/types/newsletter";

/**
 * The newsletter's safeguards, as plain functions with no I/O. They run in
 * this order for every team, every week:
 *
 *   1. Collect  -- keepSwitchedOn(): only channels a lead switched on, and
 *                  never a private channel or a DM.
 *   2. Clean    -- cleanText() and isAboutOnePerson(): private details are
 *                  removed before the AI sees anything.
 *   3. Write    -- the AI must cite the ids of what it used (lib/newsletter/draft.ts).
 *   4. Check    -- checkLines(): a line that cites nothing real is dropped,
 *                  and a line backed only by conversation is flagged.
 *   5. Save     -- only the lines and their source links are stored; the raw
 *                  messages are never written to the database.
 *
 * Steps 2 and 4 are plain code, not AI, so they behave the same every time.
 */

/** Something the draft job read this week, after cleaning. */
export type CollectedItem = SourceRef & {
  text: string;
  /**
   * True for finished work (a merged pull request, a meeting that happened),
   * false for conversation. A line backed only by conversation is flagged.
   */
  finished: boolean;
};

/** A Slack message as the collector sees it, before any safeguard runs. */
export type RawMessage = {
  id: string;
  channel: string;
  channelType: "public" | "private" | "dm";
  author: string;
  text: string;
};

/**
 * Step 1. Keeps only messages from public channels that are switched on for
 * the team. Private channels and DMs are dropped even if someone switched
 * them on by mistake.
 */
export function keepSwitchedOn(
  messages: RawMessage[],
  switchedOn: string[],
): { kept: RawMessage[]; privateSkipped: number } {
  const allowed = new Set(switchedOn.map((c) => c.toLowerCase()));
  const kept: RawMessage[] = [];
  let privateSkipped = 0;
  for (const m of messages) {
    if (m.channelType !== "public") {
      privateSkipped++;
      continue;
    }
    if (allowed.has(m.channel.toLowerCase())) kept.push(m);
  }
  return { kept, privateSkipped };
}

type Rule = { reason: string; pattern: RegExp; replace: string };

// Order matters: emails before links, so "a@docs.google.com" is one email.
const REDACTIONS: Rule[] = [
  {
    reason: "email address",
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    replace: "[email removed]",
  },
  {
    // 617-555-0142, (617) 555 0142, +1 617.555.0142
    reason: "phone number",
    pattern: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    replace: "[phone removed]",
  },
  {
    // Links into Google Docs, Drive, Forms and Sheets are private by nature:
    // the email would hand a document link to everyone it is forwarded to.
    reason: "link to a private document",
    pattern: /(?:https?:\/\/)?(?:docs|drive|forms|sheets)\.google\.com\/\S*/gi,
    replace: "[link removed]",
  },
];

/**
 * Slack writes a mention as <@Display Name>. Members keep their name; anyone
 * else becomes "someone", so the newsletter never names a person who is not
 * in the club.
 */
const MENTION = /<@([^>]+)>/g;

/**
 * Step 2a. Removes private details from one piece of text. Returns the
 * cleaned text and what was removed, as counts only.
 */
export function cleanText(
  text: string,
  memberNames: ReadonlySet<string>,
): { text: string; removed: Record<string, number> } {
  const removed: Record<string, number> = {};
  const bump = (reason: string, n = 1) => {
    removed[reason] = (removed[reason] ?? 0) + n;
  };

  let out = text.replace(MENTION, (_match, name: string) => {
    const trimmed = name.trim();
    if (memberNames.has(trimmed.toLowerCase())) return trimmed;
    bump("name of someone outside the club");
    return "someone";
  });

  for (const rule of REDACTIONS) {
    out = out.replace(rule.pattern, () => {
      bump(rule.reason);
      return rule.replace;
    });
  }

  return { text: out, removed };
}

// Deliberately narrow. "5th grade" is how the curricula teams describe the
// kids they teach, so the word "grade" alone must not trip this.
const ABOUT_ONE_PERSON = [
  /\bGPA\b/i,
  /\btranscripts?\b/i,
  /\b(?:his|her|their|my|your)\s+grades?\b/i,
  /\b(?:is|are|was|were)\s+failing\b/i,
  /\bmissed\s+\d+\s+(?:meetings|sessions|classes)\b/i,
  /\battendance\s+(?:rate|record)\b/i,
];

/**
 * Step 2b. True when a message is about one person's grades or attendance.
 * Those messages are left out whole: removing a word would still leave the
 * story.
 */
export function isAboutOnePerson(text: string): boolean {
  return ABOUT_ONE_PERSON.some((p) => p.test(text));
}

/** Adds one cleaning run's counts into the running totals. */
export function addCounts(
  into: Record<string, number>,
  from: Record<string, number>,
) {
  for (const [reason, n] of Object.entries(from)) {
    into[reason] = (into[reason] ?? 0) + n;
  }
}

export function toCountList(counts: Record<string, number>) {
  return Object.entries(counts).map(([reason, count]) => ({ reason, count }));
}

/** What the AI hands back, before the check. */
export type ProposedLine = { text: string; sourceIds: string[] };

const MAX_LINE_LENGTH = 300;

/**
 * Step 4. Keeps a line only if at least one id it cites is something the job
 * actually collected; ids it made up are removed from the line, and a line
 * left with no real source is dropped. A kept line is flagged when all of its
 * sources are conversation rather than finished work.
 *
 * The AI's own text also goes through cleanText, so a detail it repeated from
 * memory or rebuilt from pieces is caught the same way.
 */
export function checkLines(
  proposed: ProposedLine[],
  collected: CollectedItem[],
  memberNames: ReadonlySet<string>,
): {
  lines: UpdateLine[];
  checks: Pick<DraftChecks, "linesDropped" | "linesFlagged">;
  removed: Record<string, number>;
} {
  const byId = new Map(collected.map((c) => [c.id, c]));
  const lines: UpdateLine[] = [];
  const removed: Record<string, number> = {};
  let dropped = 0;

  for (const line of proposed) {
    const items = [...new Set(line.sourceIds)]
      .map((id) => byId.get(id))
      .filter((c): c is CollectedItem => c !== undefined);
    const text = line.text.trim().slice(0, MAX_LINE_LENGTH);

    if (items.length === 0 || text.length === 0) {
      dropped++;
      continue;
    }

    const cleaned = cleanText(text, memberNames);
    addCounts(removed, cleaned.removed);

    lines.push({
      text: cleaned.text,
      sources: items.map(({ id, kind, label, url }) => ({
        id,
        kind,
        label,
        ...(url ? { url } : {}),
      })),
      flagged: items.every((c) => !c.finished),
    });
  }

  return {
    lines,
    checks: {
      linesDropped: dropped,
      linesFlagged: lines.filter((l) => l.flagged).length,
    },
    removed,
  };
}
