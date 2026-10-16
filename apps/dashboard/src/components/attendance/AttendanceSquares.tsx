import { Check, Minus, X } from "lucide-react";

import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type HistoryItem = {
  id: number;
  status: string;
  title: string;
  scheduledAt: Date | string;
};

/**
 * One square per recent meeting, oldest to newest: ✓ came, ✕ marked absent,
 * – excused or not recorded. Hover or focus a square for the meeting and date.
 */
export function AttendanceSquares({ items }: { items: HistoryItem[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const label = `${item.title}, ${formatShortDate(item.scheduledAt)}: ${
          item.status === "PRESENT"
            ? "present"
            : item.status === "ABSENT"
              ? "absent"
              : item.status === "EXCUSED"
                ? "excused"
                : "not recorded"
        }`;
        return (
          <li
            key={item.id}
            title={label}
            aria-label={label}
            className={cn(
              "grid size-8 place-items-center rounded-lg [&_svg]:size-4",
              item.status === "PRESENT" && "bg-primary text-primary-foreground",
              item.status === "ABSENT" && "bg-destructive/10 text-destructive",
              (item.status === "REGISTERED" || item.status === "EXCUSED") &&
                "bg-muted text-muted-foreground",
            )}
          >
            {item.status === "PRESENT" ? (
              <Check />
            ) : item.status === "ABSENT" ? (
              <X />
            ) : (
              <Minus />
            )}
          </li>
        );
      })}
    </ul>
  );
}
