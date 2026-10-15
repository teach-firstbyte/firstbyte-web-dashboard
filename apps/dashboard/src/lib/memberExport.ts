import { isOfficerRole } from "@/lib/auth/roles";
import { toCsv } from "@/lib/csv";
import { formatIsoDate } from "@/lib/format";
import type { MemberExportRecord } from "@/types/dashboard";

// Everything the members CSV export decides, with no React: which columns
// exist, how each one reads a member, who is in the file and in what order.
// Only downloadCsv, at the bottom, touches the DOM. ExportMembersDialog only holds the officer's choices and hands them
// here, so the rules for what lands in the file live in one place.

type Membership = MemberExportRecord["teamMemberships"][number];

/** Who the file covers: every approved member, or one team's roster. */
export type ExportScope = { teamId: number | null };

export type ExportColumn = {
  key: ExportColumnKey;
  /** Header cell, and the checkbox label in the dialog. */
  label: string;
  /** Only has a value for a team roster, e.g. when that person joined it. */
  teamOnly?: boolean;
  /** The cell. `membership` is the scoped team's row, null for everyone. */
  value: (member: MemberExportRecord, membership: Membership | null) => string;
};

const titleCase = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase();

// Trimmed because RFC 4180 treats surrounding spaces as data, and a stray one
// breaks exact-match joins downstream. Empty rather than a fallback (a missing
// name does not become the email): each column means one thing, so a mail
// merge never greets someone as "Hi hb@northeastern.edu".
const text = (value: string | null) => value?.trim() ?? "";

/**
 * Every column an officer can pick, in the order the dialog first lists them.
 * Add a column here and it shows up in the dialog, the preview and the file.
 */
export const EXPORT_COLUMNS = [
  { key: "name", label: "Name", value: (m) => text(m.name) },
  {
    key: "preferredName",
    label: "Preferred name",
    value: (m) => text(m.preferredName),
  },
  { key: "email", label: "Email", value: (m) => m.email },
  { key: "pronouns", label: "Pronouns", value: (m) => text(m.pronouns) },
  {
    key: "gradYear",
    label: "Grad year",
    value: (m) => (m.gradYear === null ? "" : String(m.gradYear)),
  },
  { key: "major", label: "Major", value: (m) => text(m.major) },
  {
    key: "teams",
    label: "Teams",
    // "; " rather than ", " so the cell stays readable without CSV quoting,
    // and splits cleanly in a spreadsheet.
    value: (m) => m.teamMemberships.map((t) => t.team.name).join("; "),
  },
  {
    key: "teamRole",
    label: "Team role",
    // One team: "Lead". Everyone: each of their teams, "Website: Lead; ...".
    value: (m, membership) =>
      membership
        ? titleCase(membership.role)
        : m.teamMemberships
            .map((t) => `${t.team.name}: ${titleCase(t.role)}`)
            .join("; "),
  },
  {
    key: "joinedTeam",
    label: "Joined team",
    teamOnly: true,
    value: (_m, membership) =>
      membership ? formatIsoDate(membership.joinedAt) : "",
  },
  {
    key: "officer",
    label: "Officer",
    value: (m) => (isOfficerRole(m.role) ? "Yes" : "No"),
  },
  {
    key: "memberSince",
    label: "Member since",
    value: (m) => formatIsoDate(m.createdAt),
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  teamOnly?: boolean;
  value: ExportColumn["value"];
}>;

export type ExportColumnKey = (typeof EXPORT_COLUMNS)[number]["key"];

const COLUMNS_BY_KEY = new Map<ExportColumnKey, ExportColumn>(
  EXPORT_COLUMNS.map((c) => [c.key, c]),
);

export const ALL_COLUMN_KEYS: ExportColumnKey[] = EXPORT_COLUMNS.map(
  (c) => c.key,
);

/** What the old one-click export wrote, so it stays the starting point. */
export const DEFAULT_SELECTED: ExportColumnKey[] = ["name", "email"];

export function columnFor(key: ExportColumnKey): ExportColumn {
  // Every key comes from EXPORT_COLUMNS, so the lookup cannot miss.
  return COLUMNS_BY_KEY.get(key)!;
}

export function isColumnKey(value: unknown): value is ExportColumnKey {
  return COLUMNS_BY_KEY.has(value as ExportColumnKey);
}

export const EXPORT_SORTS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "gradYear", label: "Grad year" },
  { key: "joinedTeam", label: "Date joined team", teamOnly: true },
] as const;

export type ExportSortKey = (typeof EXPORT_SORTS)[number]["key"];

export function isSortKey(value: unknown): value is ExportSortKey {
  return EXPORT_SORTS.some((s) => s.key === value);
}

// Fixed locale, not the viewer's: an export is a file people re-import and
// diff, so two officers exporting the same roster must get identical bytes.
const COLLATOR = new Intl.Collator("en", { sensitivity: "base" });

function byName(a: MemberExportRecord, b: MemberExportRecord) {
  return (
    COLLATOR.compare(a.name ?? a.email, b.name ?? b.email) ||
    COLLATOR.compare(a.email, b.email)
  );
}

type ScopedMember = {
  member: MemberExportRecord;
  membership: Membership | null;
};

/**
 * The people in scope, each with their row for the scoped team, sorted.
 *
 * Every sort ends on name then email, so ties (same grad year, same join day)
 * still come out in one fixed order.
 */
export function membersInScope(
  members: MemberExportRecord[],
  scope: ExportScope,
  sort: ExportSortKey,
): ScopedMember[] {
  const scoped: ScopedMember[] = [];
  for (const member of members) {
    if (scope.teamId === null) {
      scoped.push({ member, membership: null });
      continue;
    }
    const membership = member.teamMemberships.find(
      (t) => t.team.id === scope.teamId,
    );
    if (membership) scoped.push({ member, membership });
  }

  // A team-only sort means nothing for everyone; fall back to name.
  const effectiveSort =
    sort === "joinedTeam" && scope.teamId === null ? "name" : sort;

  return scoped.sort((a, b) => {
    switch (effectiveSort) {
      case "email":
        return COLLATOR.compare(a.member.email, b.member.email);
      case "gradYear": {
        // Members with no grad year go last rather than first.
        const ya = a.member.gradYear ?? Number.MAX_SAFE_INTEGER;
        const yb = b.member.gradYear ?? Number.MAX_SAFE_INTEGER;
        return ya - yb || byName(a.member, b.member);
      }
      case "joinedTeam":
        return (
          new Date(a.membership!.joinedAt).getTime() -
            new Date(b.membership!.joinedAt).getTime() ||
          byName(a.member, b.member)
        );
      default:
        return byName(a.member, b.member);
    }
  });
}

/**
 * The columns that actually get written: the officer's picks, in their order,
 * minus team-only ones when the file covers everyone.
 */
export function columnsToWrite(
  order: ExportColumnKey[],
  selected: ReadonlySet<ExportColumnKey>,
  scope: ExportScope,
): ExportColumn[] {
  return order
    .filter((key) => selected.has(key))
    .map(columnFor)
    .filter((c) => scope.teamId !== null || !c.teamOnly);
}

/** Header (optional) plus one row per person, ready for toCsv. */
export function buildRows(
  people: ScopedMember[],
  columns: ExportColumn[],
  includeHeader: boolean,
): string[][] {
  const rows = people.map(({ member, membership }) =>
    columns.map((c) => c.value(member, membership)),
  );
  return includeHeader ? [columns.map((c) => c.label), ...rows] : rows;
}

/**
 * "Brand and Marketing" -> brand-and-marketing-members.csv. The id fallback
 * keeps a name that slugifies to nothing (all emoji, non-Latin script) unique.
 */
export function defaultFilename(team: { id: number; name: string } | null) {
  if (!team) return "firstbyte-members.csv";
  const slug = team.name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return `${slug || `team-${team.id}`}-members.csv`;
}

/** Whatever the officer typed, as a file name that ends in .csv. */
export function normalizeFilename(value: string, fallback: string) {
  // The browser sanitizes `download` itself; this only stops "roster" from
  // arriving without an extension and "a/b" from being read as a folder.
  const name = value.trim().replace(/[\\/]/g, "-");
  if (!name) return fallback;
  return /\.csv$/i.test(name) ? name : `${name}.csv`;
}

// Excel on Windows decodes a BOM-less UTF-8 CSV with the system codepage, so
// accented names arrive as mojibake. A leading BOM flips it to UTF-8 and is
// transparent to Sheets, Numbers and LibreOffice. Kept out of toCsv so that
// stays a clean RFC 4180 document.
const UTF8_BOM = "﻿";

/** Hands the rows to the browser as a .csv download. */
export function downloadCsv(rows: string[][], filename: string) {
  const url = URL.createObjectURL(
    new Blob([UTF8_BOM, toCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  // Firefox historically ignored click() on a detached node.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same tick races the download in Safari: the click
  // schedules the fetch, it does not complete it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
