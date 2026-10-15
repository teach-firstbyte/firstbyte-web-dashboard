import { cn } from "@/lib/utils";

/**
 * A thin bar showing part of a whole. Several parts stack left to right, e.g.
 * present then absent on the attendance roster.
 */
export function Meter({
  parts,
  total,
  label,
  className,
}: {
  parts: { value: number; tone?: "primary" | "destructive" | "warning" }[];
  total: number;
  /** For screen readers, e.g. "12 of 24 checked in". */
  label: string;
  className?: string;
}) {
  const safeTotal = Math.max(total, 1);
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex h-2 overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      {parts.map((part, i) => (
        <span
          key={i}
          className={cn(
            "h-full transition-[width] duration-300",
            (part.tone ?? "primary") === "primary" && "bg-primary",
            part.tone === "destructive" && "bg-destructive",
            part.tone === "warning" && "bg-warning",
          )}
          style={{ width: `${(part.value / safeTotal) * 100}%` }}
        />
      ))}
    </div>
  );
}
