import { Badge } from "@/components/ui/badge";

// Mirrors the AttendanceStatus enum in prisma/schema.prisma. Shared by the
// attendance table and the meeting detail panel's roster so the two can't drift.
export function AttendanceStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PRESENT":
      return <Badge variant="default">Present</Badge>;
    case "ABSENT":
      return <Badge variant="destructive">Absent</Badge>;
    case "EXCUSED":
      return <Badge variant="secondary">Excused</Badge>;
    case "REGISTERED":
      // Left over from before the attendance rework: nobody recorded them.
      return <Badge variant="outline">Not recorded</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
