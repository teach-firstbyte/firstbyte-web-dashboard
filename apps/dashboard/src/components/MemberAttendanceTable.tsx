import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MemberAttendanceRow } from "@/types/dashboard";
import {
  MemberAttendanceKey,
  MEMBER_ATTENDANCE_LABELS,
} from "@/lib/attendance/member-status";
import { TableEmptyState } from "./ui/TableEmptyState";

const BADGE_VARIANTS: Record<
  MemberAttendanceKey,
  "default" | "destructive" | "outline" | "secondary"
> = {
  PRESENT: "default",
  EXCUSED: "outline",
  ABSENT: "destructive",
};

interface MemberAttendanceTableProps {
  rows: MemberAttendanceRow[];
  emptyMessage?: string;
}

export function MemberAttendanceTable({
  rows,
  emptyMessage = "No attendance records yet.",
}: MemberAttendanceTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your attendance records</CardTitle>
        <CardDescription>
          Meetings you came to, were excused from, or missed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meeting</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Feedback</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmptyState colSpan={3} message={emptyMessage} />
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{row.meeting.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {row.meeting.scheduledAt.toLocaleDateString()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={BADGE_VARIANTS[row.displayStatus]}>
                      {MEMBER_ATTENDANCE_LABELS[row.displayStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.displayStatus === "PRESENT" &&
                      (row.hasFeedback ? (
                        <span className="text-sm text-muted-foreground">
                          Submitted
                        </span>
                      ) : (
                        <Button asChild size="sm">
                          <Link href={`/feedback/${row.meetingId}`}>
                            Leave feedback
                          </Link>
                        </Button>
                      ))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
