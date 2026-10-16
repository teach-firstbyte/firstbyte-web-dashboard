import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** "Maya Okafor" -> "MO". Falls back to the first letter of an email. */
export function initialsOf(name: string | null | undefined, email?: string) {
  const source = name?.trim() || email || "?";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/**
 * A person's initials in a circle. No profile photos are stored, so this is
 * the shadcn Avatar with only its fallback.
 */
export function PersonAvatar({
  name,
  email,
  size = "default",
  tone = "brand",
}: {
  name: string | null | undefined;
  email?: string;
  size?: "sm" | "default" | "lg";
  /** "muted" for people not marked yet, "danger" for absences. */
  tone?: "brand" | "muted" | "danger";
}) {
  return (
    <Avatar
      aria-hidden="true"
      className={cn(
        size === "sm" && "size-7",
        size === "default" && "size-9",
        size === "lg" && "size-14",
      )}
    >
      <AvatarFallback
        className={cn(
          "font-semibold",
          size === "lg" ? "text-lg" : "text-xs",
          tone === "brand" && "bg-primary/12 text-primary",
          tone === "danger" && "bg-destructive/10 text-destructive",
        )}
      >
        {initialsOf(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}
