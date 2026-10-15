"use client";

import * as React from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Shown faded after the label, e.g. a count. */
  count?: number;
}

/**
 * A pill row where exactly one option is on: Upcoming / Past, the attendance
 * filters, the theme picker, a meeting's type. Built on the shadcn ToggleGroup,
 * which brings arrow-key movement and the pressed state for screen readers.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  variant = "pills",
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Read by screen readers, e.g. "Which meetings". */
  label: string;
  /** "pills" sits in a shaded track; "chips" are separate outlined chips. */
  variant?: "pills" | "chips";
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // Radix sends "" when the active item is clicked again; this control
      // always keeps one option on, so ignore that.
      onValueChange={(next) => next && onValueChange(next as T)}
      aria-label={label}
      variant={variant === "chips" ? "outline" : "default"}
      spacing={variant === "chips" ? 2 : 0}
      className={
        variant === "pills"
          ? "max-w-full flex-wrap rounded-full bg-muted p-1"
          : "max-w-full flex-wrap"
      }
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className={
            variant === "pills"
              ? "rounded-full px-3.5 data-[state=on]:bg-card data-[state=on]:shadow-sm"
              : "rounded-full px-3 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          }
        >
          {option.label}
          {option.count !== undefined && (
            <span className="tabular-nums opacity-60">{option.count}</span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
