import * as React from "react";

import { cn } from "@/lib/utils";

// Building blocks for the record detail panels. DetailField is the single place
// that decides how a missing value renders, so a null `description`, `notes`,
// `checkedOutAt`, `rating`, or `location` shows a placeholder instead of
// leaking "null" or "N/A" into the panel.

const EMPTY_PLACEHOLDER = "—";

function DetailSection({
  title,
  action,
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & {
  title: string;
  /**
   * Optional control aligned to the end of the heading row, for a section that
   * owns an action on its own contents -- the team panel's CSV export.
   *
   * Omitting it leaves the heading exactly where it was: a flex row with one
   * child, which `justify-between` puts at the start.
   */
  action?: React.ReactNode;
}) {
  return (
    <section
      data-slot="detail-section"
      className={cn("space-y-3", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailGrid({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="detail-grid"
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}
      {...props}
    />
  );
}

/**
 * Renders one labelled value. Pass the raw value through `value`; only
 * `null`, `undefined`, and empty/whitespace-only strings are treated as
 * missing. `0` and `false` are real data (an unrated feedback entry has
 * `rating: null`, but a capacity of 0 or `isRequired: false` means something)
 * so they render normally.
 *
 * Pass `children` instead when the value needs custom markup, such as badges.
 */
function DetailField({
  label,
  value,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const hasChildren = children !== undefined && children !== null;
  const isMissing =
    !hasChildren &&
    (value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === ""));

  return (
    <div
      data-slot="detail-field"
      className={cn("min-w-0 space-y-1", className)}
      {...props}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm break-words",
          isMissing && "text-muted-foreground/60 italic",
        )}
      >
        {hasChildren ? children : isMissing ? EMPTY_PLACEHOLDER : value}
      </dd>
    </div>
  );
}

/** Shown in place of a relation list when the record has no related rows. */
function DetailEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground/60 italic">{children}</p>;
}

export { DetailSection, DetailGrid, DetailField, DetailEmpty };
