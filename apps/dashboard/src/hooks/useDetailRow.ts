"use client";

import * as React from "react";

// Shared row-trigger behaviour for the officer dashboard tables and lists. Each table
// keeps its own existing state (add/assign modals, filters); this hook only owns
// which row's detail panel is open, and it hands back props to spread onto the
// <TableRow> (or any list row, e.g. an <li> in the Meetings list).

// Elements that own their own clicks. `a[href]` covers both the mailto: link in
// UsersTable and the three Next.js <Link>s in MeetingsTable, which render as
// plain anchors. The form controls aren't in a row today; they're listed so an
// inline control added later doesn't silently open the panel on top of itself.
const INTERACTIVE_SELECTOR =
  "button, a[href], input, select, textarea, label, [role='button']";

/**
 * Decides whether a click that landed inside a row should be ignored, because
 * the row contains its own control that owns that click.
 *
 * `target` is the deepest element the click hit; `row` is the <tr> the handler
 * is attached to. The `row.contains` check matters because `closest` keeps
 * climbing past the row -- without it, any ancestor link wrapping the table
 * would stop every row from opening.
 */
function isInteractiveTarget(target: EventTarget | null, row: HTMLElement) {
  if (!(target instanceof Element)) return false;

  // React bubbles events through portals, so a click on a ⋯ menu item or a
  // dialog opened from the row reaches this handler even though that element
  // is drawn elsewhere on the page. Only clicks on the row itself count.
  if (!row.contains(target)) return true;

  const hit = target.closest(INTERACTIVE_SELECTOR);
  return hit !== null && row.contains(hit);
}

export function useDetailRow<T>() {
  const [selected, setSelected] = React.useState<T | null>(null);

  // The Sheet has no Radix Trigger (the row is the trigger), so remember which
  // row opened it and aim focus back there when it closes.
  const originRef = React.useRef<HTMLElement | null>(null);

  const open = React.useCallback((item: T, row: HTMLElement) => {
    originRef.current = row;
    setSelected(item);
  }, []);

  const close = React.useCallback(() => setSelected(null), []);

  /** Pass to the Sheet's `onOpenChange` -- covers Escape and backdrop clicks. */
  const onOpenChange = React.useCallback((next: boolean) => {
    if (!next) setSelected(null);
  }, []);

  /** Pass to SheetContent's `onCloseAutoFocus`. */
  const onCloseAutoFocus = React.useCallback((event: Event) => {
    const origin = originRef.current;
    if (!origin || !origin.isConnected) return;
    event.preventDefault();
    origin.focus();
  }, []);

  const getRowProps = React.useCallback(
    (item: T): React.HTMLAttributes<HTMLElement> => ({
      tabIndex: 0,
      "aria-haspopup": "dialog",
      className:
        "cursor-pointer focus-visible:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
      onClick: (event) => {
        if (isInteractiveTarget(event.target, event.currentTarget)) return;
        open(item, event.currentTarget);
      },
      onKeyDown: (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        // A link or button inside the row that has focus handles its own keys.
        if (event.target !== event.currentTarget) return;
        // Space would otherwise scroll the page.
        event.preventDefault();
        open(item, event.currentTarget);
      },
    }),
    [open],
  );

  return { selected, open, close, onOpenChange, onCloseAutoFocus, getRowProps };
}
