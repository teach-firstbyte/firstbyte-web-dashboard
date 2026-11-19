"use client";

import * as React from "react";

import { PersonAvatar } from "@/components/common/PersonAvatar";
import { Input } from "@/components/ui/input";
import {
  matchOwners,
  ownerName,
  ownerRole,
  type OwnerChoice,
} from "@/lib/tasks/owners";
import { cn } from "@/lib/utils";

/**
 * Picks a task's owner by typing: an ARIA 1.2 combobox (an input with a
 * listbox popup) over the e-board.
 *
 * - Typing filters by first name, last name, preferred name or role
 *   ("events" finds the Events lead). See matchOwners.
 * - Arrow keys move the highlight. Enter or Tab accepts it. Escape closes
 *   the list, and a second Escape is left to whatever is around it.
 * - Leaving the field with text that matches exactly one person picks them.
 *
 * Controlled on both halves, so the parent can reset it after a save:
 * `value` is the picked owner's id (null for none) and `inputValue` the text.
 * Editing the text clears the pick, so what's shown is never a stale person.
 *
 * Shared by the meeting page's Action items (#134) and the board's New task
 * form (#135).
 */
export type OwnerComboboxProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "defaultValue" | "role"
> & {
  owners: readonly OwnerChoice[];
  value: number | null;
  onValueChange: (owner: OwnerChoice | null) => void;
  inputValue: string;
  onInputValueChange: (text: string) => void;
  /**
   * Enter was pressed. Runs after any highlighted person is accepted, with
   * whoever is picked now (null if no one), so the parent can move on without
   * waiting for a re-render. Without it, Enter with the list closed is left
   * alone, and submits the surrounding form as usual.
   */
  onEnter?: (owner: OwnerChoice | null) => void;
  /** Classes for the popup list, e.g. a bigger text size. */
  listClassName?: string;
  /** Classes for the wrapper. `className` goes on the input. */
  wrapperClassName?: string;
};

export const OwnerCombobox = React.forwardRef<
  HTMLInputElement,
  OwnerComboboxProps
>(function OwnerCombobox(
  {
    owners,
    value,
    onValueChange,
    inputValue,
    onInputValueChange,
    onEnter,
    listClassName,
    wrapperClassName,
    className,
    onFocus,
    onBlur,
    onKeyDown,
    id: idProp,
    ...inputProps
  },
  ref,
) {
  const autoId = React.useId();
  const id = idProp ?? autoId;
  const listId = `${id}-list`;
  const optionId = (ownerId: number) => `${id}-opt-${ownerId}`;

  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);

  const matches = React.useMemo(
    () => matchOwners(inputValue, owners),
    [inputValue, owners],
  );
  const showList = open && matches.length > 0;
  const showNoMatch = open && matches.length === 0 && inputValue.trim() !== "";
  const active = showList
    ? matches[Math.min(highlight, matches.length - 1)]
    : undefined;

  const listRef = React.useRef<HTMLUListElement>(null);
  React.useEffect(() => {
    if (!active) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(active.id))}`)
      ?.scrollIntoView({ block: "nearest" });
    // optionId only depends on id, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const picked =
    value === null ? null : (owners.find((o) => o.id === value) ?? null);

  const accept = (o: OwnerChoice) => {
    onValueChange(o);
    onInputValueChange(ownerName(o));
    setOpen(false);
    return o;
  };

  /** The one person the text can only mean, if there is one. */
  const resolve = (): OwnerChoice | null => {
    if (picked) return picked;
    if (inputValue.trim() && matches.length === 1) return accept(matches[0]);
    return null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!showList) {
          setOpen(true);
          setHighlight(
            e.key === "ArrowDown" ? 0 : Math.max(matches.length - 1, 0),
          );
          return;
        }
        const step = e.key === "ArrowDown" ? 1 : -1;
        setHighlight((h) => (h + step + matches.length) % matches.length);
        return;
      }
      case "Enter": {
        const owner = active ? accept(active) : resolve();
        if (onEnter) {
          e.preventDefault();
          onEnter(owner);
        } else if (active) {
          // Picking from the list shouldn't also submit the form.
          e.preventDefault();
        }
        return;
      }
      case "Tab":
        // Accept and let focus move on as usual.
        if (active && inputValue.trim()) accept(active);
        else resolve();
        return;
      case "Escape":
        if (open) {
          // Only the list closes; a dialog around this stays open.
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
        return;
    }
  };

  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      <Input
        ref={ref}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active ? optionId(active.id) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={inputValue}
        className={className}
        onChange={(e) => {
          if (value !== null) onValueChange(null);
          onInputValueChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={(e) => {
          onFocus?.(e);
          // A picked owner doesn't need the list again until they type.
          if (value === null) {
            setOpen(true);
            setHighlight(0);
          }
        }}
        onBlur={(e) => {
          onBlur?.(e);
          resolve();
          setOpen(false);
        }}
        onKeyDown={handleKeyDown}
        {...inputProps}
      />
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="E-board members"
        hidden={!showList}
        className={cn(
          "absolute top-full left-0 z-30 mt-1 max-h-72 w-max max-w-[min(32rem,90vw)] min-w-full overflow-y-auto rounded-xl border bg-popover p-1 text-sm text-popover-foreground shadow-lg",
          listClassName,
        )}
      >
        {showList &&
          matches.map((o) => {
            const selected = o.id === active?.id;
            return (
              <li
                key={o.id}
                id={optionId(o.id)}
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5",
                  selected && "bg-accent text-accent-foreground",
                )}
                // mousedown, not click: it lands before the input's blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(o);
                }}
                onMouseMove={() => setHighlight(matches.indexOf(o))}
              >
                <PersonAvatar name={ownerName(o)} size="sm" />
                <span className="min-w-0 truncate font-medium">
                  {ownerName(o)}
                </span>
                <span className="ml-auto shrink-0 text-right text-[0.85em] text-muted-foreground">
                  {ownerRole(o)}
                </span>
              </li>
            );
          })}
      </ul>
      {showNoMatch && (
        <div
          className={cn(
            "absolute top-full left-0 z-30 mt-1 w-max max-w-[min(32rem,90vw)] min-w-full rounded-xl border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg",
            listClassName,
          )}
        >
          No one on the e-board matches “{inputValue.trim()}”.
        </div>
      )}
    </div>
  );
});
