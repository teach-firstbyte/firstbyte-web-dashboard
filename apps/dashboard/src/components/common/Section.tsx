import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

// Page-level building blocks for FirstByte screens. They compose shadcn
// primitives and have no hooks, so server components can render them.

/**
 * The card every home-page block sits in: a title row with an optional count
 * and action on the right, then the content.
 *
 * Lighter than Card/CardHeader/CardContent on purpose. Those stay for the
 * dense data tables; this is for the short, scannable blocks.
 */
export function Section({
  title,
  count,
  action,
  id,
  className,
  children,
}: {
  title: React.ReactNode;
  /** A small amber count after the title, for things waiting on someone. */
  count?: number;
  action?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "flex min-w-0 scroll-mt-24 flex-col gap-3 rounded-2xl border bg-card p-5 text-card-foreground",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="warning" className="tabular-nums">
              {count}
            </Badge>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A divided list inside a Section. Each child is one <li>. */
export function RowList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <ul className={cn("-my-1 divide-y", className)}>{children}</ul>;
}

/** What a Section shows when it has nothing in it. The shadcn Empty. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="p-4">
      <EmptyHeader>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

/** The heading block at the top of a page. */
export function PageHeader({
  title,
  description,
  back,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A BackLink, rendered above the title. */
  back?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
      <div className="flex min-w-0 flex-col gap-1">
        {back && <div className="-ml-3">{back}</div>}
        <h1 className="text-[clamp(1.6rem,3vw,2rem)] font-bold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[15px] text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
