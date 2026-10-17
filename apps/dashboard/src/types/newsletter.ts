// Props shapes for the newsletter screens. Like types/dashboard.ts, nothing
// here imports @prisma/client, so client components can use it freely.

import type {
  NewsletterIssueStatusValue,
  TeamUpdateStatusValue,
} from "@/lib/enums";

/** Where a line of a draft came from. Shown next to the line, never hidden. */
export type SourceRef = {
  /** Unique within one draft run, e.g. "gh-131" or "slack-website-3". */
  id: string;
  kind: "github" | "slack" | "meeting";
  /** "PR #131", "#website (sample)", "General Meeting, Oct 14". */
  label: string;
  url?: string;
};

/** One line of a team's update. */
export type UpdateLine = {
  text: string;
  sources: SourceRef[];
  /**
   * True when every source is a conversation rather than finished work, so
   * the lead is asked to double-check it before it goes out.
   */
  flagged: boolean;
};

/** What the safeguards removed from one draft, as counts and reasons only. */
export type DraftChecks = {
  /** Messages never collected: private channels and DMs. */
  privateSkipped?: number;
  /** Details removed before the AI saw anything: "phone number", ... */
  redactions?: { reason: string; count: number }[];
  /** Messages left out entirely, e.g. about one person's grades. */
  messagesDropped?: { reason: string; count: number }[];
  /** Lines the AI wrote that cited nothing real, so they never reached a lead. */
  linesDropped?: number;
  /** Lines highlighted because their only sources are conversation. */
  linesFlagged?: number;
  /** Which model wrote the draft, for the record. */
  model?: string;
};

export type TeamUpdateView = {
  id: number;
  teamId: number;
  teamName: string;
  status: TeamUpdateStatusValue;
  lines: UpdateLine[];
  aiLines: UpdateLine[];
  checks: DraftChecks;
  aiError: string | null;
  photo: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
};

export type IssueView = {
  id: number;
  weekOf: string;
  status: NewsletterIssueStatusValue;
  note: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  sentAt: string | null;
  sentCount: number | null;
  updates: TeamUpdateView[];
};

export type UpcomingEvent = {
  id: number;
  title: string;
  scheduledAt: string;
  location: string | null;
  isRequired: boolean;
  type: string;
};

/** A sample photo the lead can attach, until photos come from Google Drive. */
export type SamplePhoto = { key: string; label: string; src: string };
