"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Download, RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ALL_COLUMN_KEYS,
  buildRows,
  columnFor,
  columnsToWrite,
  DEFAULT_SELECTED,
  defaultFilename,
  downloadCsv,
  EXPORT_SORTS,
  isColumnKey,
  isSortKey,
  membersInScope,
  normalizeFilename,
  type ExportColumnKey,
  type ExportSortKey,
} from "@/lib/memberExport";
import { withBasePath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import type { MemberExportRecord } from "@/types/dashboard";

type TeamRef = { id: number; name: string };

/** How many people the preview table shows before "and N more". */
const PREVIEW_ROWS = 3;

// The officer's column picks, order, sort and header choice, remembered in
// this browser so the next export starts where the last one ended. A
// convenience only: if storage is blocked the dialog opens on the defaults.
const PREFS_KEY = "firstbyte:member-export:v1";

type Prefs = {
  order: ExportColumnKey[];
  selected: ExportColumnKey[];
  sort: ExportSortKey;
  includeHeader: boolean;
};

const DEFAULT_PREFS: Prefs = {
  order: ALL_COLUMN_KEYS,
  selected: DEFAULT_SELECTED,
  sort: "name",
  includeHeader: true,
};

function loadPrefs(): Prefs {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
    const saved = raw as Record<string, unknown>;

    const order = Array.isArray(saved.order)
      ? saved.order.filter(isColumnKey)
      : [];
    const selected = Array.isArray(saved.selected)
      ? saved.selected.filter(isColumnKey)
      : [];

    return {
      // A column added since these were saved goes on the end, so it never
      // silently disappears from the list.
      order: [...new Set([...order, ...ALL_COLUMN_KEYS])],
      selected: selected.length > 0 ? selected : DEFAULT_SELECTED,
      sort: isSortKey(saved.sort) ? saved.sort : DEFAULT_PREFS.sort,
      includeHeader:
        typeof saved.includeHeader === "boolean"
          ? saved.includeHeader
          : DEFAULT_PREFS.includeHeader,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Private window or blocked storage: the export still works, it just
    // won't remember these choices.
  }
}

/** The members the export can write, fetched each time the dialog opens. */
function useExportMembers() {
  const [members, setMembers] = React.useState<MemberExportRecord[] | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch(withBasePath("/api/users/export"))
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Could not load members.");
        return data as MemberExportRecord[];
      })
      .then((data) => {
        if (!cancelled) setMembers(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load members.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  return { members, error, retry };
}

/**
 * "Export CSV". Opens the export dialog, already pointed at `team` when it is
 * given (the team panel) or at everyone (the Members page).
 */
export function ExportMembersButton({
  team,
  disabled,
  size = "sm",
}: {
  team?: TeamRef;
  disabled?: boolean;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = React.useState(false);
  // Bumped per open, so each export starts from fresh data and the team the
  // button belongs to, while the column choices come back from storage.
  const [session, setSession] = React.useState(0);

  return (
    <>
      <Button
        variant="outline"
        size={size}
        disabled={disabled}
        // Disabled rather than hidden, so the section header stays put and
        // the title says why.
        title={disabled ? "No members to export." : undefined}
        // Contains the visible label verbatim, so speech input still matches.
        aria-label={team ? `Export CSV for ${team.name}` : undefined}
        onClick={() => {
          setSession((s) => s + 1);
          setOpen(true);
        }}
      >
        <Download data-icon="inline-start" />
        Export CSV
      </Button>
      {open && (
        <ExportMembersDialog
          key={session}
          initialTeam={team ?? null}
          open
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

/**
 * Pick who goes in the file, which columns and in what order, how rows are
 * sorted, and the file name, with a live preview of the first rows. What ends
 * up in the file is decided by lib/memberExport.ts; this only holds the
 * choices.
 */
export function ExportMembersDialog({
  initialTeam,
  open,
  onOpenChange,
}: {
  initialTeam: TeamRef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { members, error: loadError, retry } = useExportMembers();
  const [teamId, setTeamId] = React.useState<number | null>(
    initialTeam?.id ?? null,
  );
  const [prefs, setPrefs] = React.useState<Prefs>(loadPrefs);
  // null means "follow the team", so switching teams renames the file until
  // the officer types their own name.
  const [filename, setFilename] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Teams come from the memberships themselves, with a head count each. A
  // team nobody is on has nothing to export, so it is not offered -- except
  // the one this dialog was opened from, which must stay selectable.
  const teams = React.useMemo(() => {
    const byId = new Map<number, TeamRef & { count: number }>();
    for (const member of members ?? []) {
      for (const { team } of member.teamMemberships) {
        const entry = byId.get(team.id) ?? { ...team, count: 0 };
        entry.count += 1;
        byId.set(team.id, entry);
      }
    }
    if (initialTeam && !byId.has(initialTeam.id)) {
      byId.set(initialTeam.id, { ...initialTeam, count: 0 });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, initialTeam]);

  const scope = { teamId };
  const scopedTeam = teams.find((t) => t.id === teamId) ?? null;
  const selected = new Set(prefs.selected);
  const columns = columnsToWrite(prefs.order, selected, scope);
  const people = members ? membersInScope(members, scope, prefs.sort) : [];
  const fallbackName = defaultFilename(scopedTeam);
  const loading = members === null && loadError === null;

  function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
    setError(null);
  }

  function toggle(key: ExportColumnKey) {
    update({
      selected: selected.has(key)
        ? prefs.selected.filter((k) => k !== key)
        : [...prefs.selected, key],
    });
  }

  function move(key: ExportColumnKey, by: -1 | 1) {
    const order = [...prefs.order];
    const from = order.indexOf(key);
    const to = from + by;
    if (to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    update({ order });
  }

  function download() {
    if (columns.length === 0) {
      setError("Pick at least one column.");
      return;
    }
    if (people.length === 0) {
      setError("Nobody to export for this choice.");
      return;
    }
    downloadCsv(
      buildRows(people, columns, prefs.includeHeader),
      normalizeFilename(filename ?? fallbackName, fallbackName),
    );
    toast.success(
      `Exported ${people.length} ${people.length === 1 ? "member" : "members"}`,
    );
    onOpenChange(false);
  }

  // A team-only sort reads as "Name" while the file covers everyone, which is
  // what membersInScope falls back to.
  const sortShown =
    prefs.sort === "joinedTeam" && teamId === null ? "name" : prefs.sort;
  const previewRows = buildRows(people.slice(0, PREVIEW_ROWS), columns, false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export members</DialogTitle>
          <DialogDescription>
            Choose who&apos;s in the file and which columns it has. Opens in
            Excel, Google Sheets or Numbers.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            download();
          }}
        >
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="export-scope">Who</FieldLabel>
              <NativeSelect
                id="export-scope"
                data-full
                value={teamId ?? ""}
                disabled={loading}
                onChange={(e) => {
                  setTeamId(e.target.value ? Number(e.target.value) : null);
                  setError(null);
                }}
              >
                <NativeSelectOption value="">
                  All members{members ? ` (${members.length})` : ""}
                </NativeSelectOption>
                {teams.map((t) => (
                  <NativeSelectOption key={t.id} value={t.id}>
                    {t.name} ({t.count})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            <FieldSet>
              <div className="flex items-center justify-between gap-2">
                <FieldLegend variant="label" className="mb-0">
                  Columns
                </FieldLegend>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => update({ selected: ALL_COLUMN_KEYS })}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => update(DEFAULT_PREFS)}
                  >
                    Reset
                  </Button>
                </div>
              </div>
              <FieldDescription>
                Check what to include. The arrows change the column order.
              </FieldDescription>
              <ul className="grid gap-1.5">
                {prefs.order.map((key, index) => {
                  const column = columnFor(key);
                  const unavailable = !!column.teamOnly && teamId === null;
                  const id = `export-column-${key}`;
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-2 rounded-lg border py-1 pr-1 pl-3 text-sm has-[input:checked]:border-primary has-[input:disabled]:opacity-60"
                    >
                      <input
                        id={id}
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selected.has(key) && !unavailable}
                        disabled={unavailable}
                        onChange={() => toggle(key)}
                      />
                      <label htmlFor={id} className="min-w-0 flex-1 py-1">
                        {column.label}
                        {unavailable && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            Pick a team to use this
                          </span>
                        )}
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Move ${column.label} up`}
                        disabled={index === 0}
                        onClick={() => move(key, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Move ${column.label} down`}
                        disabled={index === prefs.order.length - 1}
                        onClick={() => move(key, 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </FieldSet>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="export-sort">Sort by</FieldLabel>
                <NativeSelect
                  id="export-sort"
                  data-full
                  value={sortShown}
                  onChange={(e) => {
                    if (isSortKey(e.target.value)) {
                      update({ sort: e.target.value });
                    }
                  }}
                >
                  {EXPORT_SORTS.map((s) => (
                    <NativeSelectOption
                      key={s.key}
                      value={s.key}
                      disabled={"teamOnly" in s && teamId === null}
                    >
                      {s.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field orientation="horizontal" className="rounded-xl border p-3">
                <FieldContent>
                  <FieldLabel htmlFor="export-header">Header row</FieldLabel>
                  <FieldDescription>Column names on line 1.</FieldDescription>
                </FieldContent>
                <Switch
                  id="export-header"
                  checked={prefs.includeHeader}
                  onCheckedChange={(v) => update({ includeHeader: v })}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="export-filename">File name</FieldLabel>
              <Input
                id="export-filename"
                value={filename ?? fallbackName}
                onChange={(e) => setFilename(e.target.value)}
                spellCheck={false}
              />
            </Field>

            <section aria-labelledby="export-preview" className="grid gap-2">
              <h3 id="export-preview" className="text-sm font-medium">
                Preview
                {members && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {people.length} {people.length === 1 ? "row" : "rows"}
                  </span>
                )}
              </h3>
              <PreviewBody
                loading={loading}
                loadError={loadError}
                onRetry={retry}
                headers={columns.map((c) => c.label)}
                rows={previewRows}
                more={people.length - previewRows.length}
                includeHeader={prefs.includeHeader}
              />
            </section>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={members === null}>
              <Download data-icon="inline-start" />
              Download CSV
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({
  loading,
  loadError,
  onRetry,
  headers,
  rows,
  more,
  includeHeader,
}: {
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  headers: string[];
  rows: string[][];
  more: number;
  includeHeader: boolean;
}) {
  const box = "rounded-xl border p-4 text-sm text-muted-foreground";

  if (loading) {
    return (
      <div className={cn(box, "flex items-center gap-2")}>
        <Spinner />
        Loading members…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className={cn(box, "flex items-center justify-between gap-3")}>
        <span role="alert">{loadError}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RotateCw data-icon="inline-start" />
          Try again
        </Button>
      </div>
    );
  }
  if (headers.length === 0) {
    return <div className={box}>Pick a column to see a preview.</div>;
  }
  if (rows.length === 0) {
    return <div className={box}>Nobody matches this choice.</div>;
  }

  return (
    <div className="rounded-xl border">
      <Table className="text-xs">
        <TableHeader>
          <TableRow
            className={cn(!includeHeader && "text-muted-foreground italic")}
          >
            {headers.map((h) => (
              <TableHead key={h} className="h-8 whitespace-nowrap">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j} className="max-w-48 truncate py-1.5">
                  {cell || <span className="text-muted-foreground">—</span>}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {(more > 0 || !includeHeader) && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          {more > 0 && `…and ${more} more. `}
          {!includeHeader && "The header row won't be in the file."}
        </p>
      )}
    </div>
  );
}
