"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv } from "@/lib/csv";
import type { Team } from "@/types/dashboard";

// Excel on Windows decodes a BOM-less UTF-8 CSV with the system codepage, so
// "Jose Nunez" with its accents arrives as mojibake. A leading BOM flips it to
// UTF-8 and is transparent to Sheets, Numbers and LibreOffice. Passed as its
// own Blob part so toCsv keeps returning a clean RFC 4180 document.
const UTF8_BOM = "﻿";

// Fixed locale, not the viewer's: an export is a file people re-import and
// diff, so two officers exporting the same roster must get identical bytes.
const COLLATOR = new Intl.Collator("en", { sensitivity: "base" });

/**
 * The nested `members` select in server/teams/select.ts carries no orderBy, so
 * Postgres returns join rows in heap order, which reshuffles whenever any
 * TeamMember row is updated. Two exports of an unchanged roster would
 * otherwise differ, making any diff of them noise.
 *
 * Sorted here rather than in the query on purpose: teamWithMembersArgs is
 * shared by the table, the detail sheet and getTeamWithMembers, so adding an
 * orderBy there would silently reorder every roster in the product inside a
 * change titled "add CSV export". Worth doing, as its own change.
 */
function sortedMembers(members: Team["members"]) {
  // Spread first -- never sort the prop array in place; that mutates the object
  // React handed us and can reorder the rendered list on a re-render.
  // (Spread + sort rather than toSorted: tsconfig targets ES2017.)
  return [...members].sort(
    (a, b) =>
      COLLATOR.compare(
        a.user.name ?? a.user.email,
        b.user.name ?? b.user.email,
      ) || COLLATOR.compare(a.user.email, b.user.email),
  );
}

/**
 * "Brand and Marketing" -> brand-and-marketing-members.csv, "E-Board" ->
 * e-board-members.csv. Purely cosmetic -- the browser sanitises `download`, so
 * unlike a Content-Disposition header there is no injection risk here. The id
 * fallback keeps a name that slugifies to nothing (all emoji, non-Latin
 * script) unique and traceable back to a row.
 */
function filenameFor(team: Team): string {
  const slug = team.name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");

  return `${slug || `team-${team.id}`}-members.csv`;
}

export function ExportTeamMembersButton({ team }: { team: Team }) {
  const isEmpty = team.members.length === 0;

  function handleExport() {
    const csv = toCsv([
      ["name", "email"],
      ...sortedMembers(team.members).map((m) => [
        // Empty, not a fallback to the email. The column is called `name`, and
        // substituting the email makes the two columns silently duplicate --
        // a mail merge would greet someone as "Hi hb@northeastern.edu".
        // Nothing is lost; the email is right there in column 2. Trimmed
        // because RFC 4180 treats surrounding spaces as data, and a stray one
        // breaks exact-match joins downstream.
        m.user.name?.trim() ?? "",
        m.user.email,
      ]),
    ]);

    const url = URL.createObjectURL(
      new Blob([UTF8_BOM, csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filenameFor(team);
    // Firefox historically ignored click() on a detached node.
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoking in the same tick races the download in Safari: the click
    // schedules the fetch, it does not complete it.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isEmpty}
      // Disabled rather than hidden, matching the Edit button in TeamsTable:
      // the header stays put and the title says why.
      title={isEmpty ? "This team has no members to export." : undefined}
      // Contains the visible label verbatim, so speech input still matches it.
      aria-label={`Export CSV for ${team.name}`}
    >
      <Download />
      Export CSV
    </Button>
  );
}
