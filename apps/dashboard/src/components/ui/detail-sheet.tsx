"use client";

import * as React from "react";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface DetailSheetProps<T> {
  /** The row to show, or null when the panel is closed. */
  record: T | null;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  title: (record: T) => React.ReactNode;
  description?: (record: T) => React.ReactNode;
  children: (record: T) => React.ReactNode;
}

/**
 * Shell for the record detail panels: owns the Sheet wiring and renders its body
 * from `record` alone, so a panel can never show data the table didn't hand it.
 * That matters for feedback, where listFeedbackForViewer has already stripped
 * the author server-side -- a panel that fetched its own copy would undo that.
 */
export function DetailSheet<T>({
  record,
  onOpenChange,
  onCloseAutoFocus,
  title,
  description,
  children,
}: DetailSheetProps<T>) {
  // `record` goes null the instant the panel starts closing, but Radix keeps the
  // panel mounted for its slide-out animation. Holding the last record keeps the
  // body from blanking mid-animation. Selecting a different row replaces it
  // outright, so nothing from the previous row survives into the next open.
  const [lingering, setLingering] = React.useState(record);
  if (record !== null && record !== lingering) {
    setLingering(record);
  }
  const shown = record ?? lingering;

  return (
    <Sheet open={record !== null} onOpenChange={onOpenChange}>
      <SheetContent onCloseAutoFocus={onCloseAutoFocus}>
        {shown !== null && (
          <>
            <SheetHeader>
              <SheetTitle>{title(shown)}</SheetTitle>
              {description && (
                <SheetDescription>{description(shown)}</SheetDescription>
              )}
            </SheetHeader>
            <SheetBody>{children(shown)}</SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
