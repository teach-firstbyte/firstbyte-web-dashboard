"use client";

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
import { Attendance } from "@/types/dashboard";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";

interface AttendanceTableProps {
  attendance: Attendance[];
  emptyMessage?: string;
}

export function AttendanceTable({
  attendance,
  emptyMessage = "No attendance records yet.",
}: AttendanceTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Records</CardTitle>
        <CardDescription>User attendance for all meetings</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Meeting</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Checked In</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendance.length === 0 ? (
              <TableEmptyState colSpan={5} message={emptyMessage} />
            ) : (
              attendance.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {record.user.name || "N/A"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {record.user.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{record.meeting.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(record.meeting.scheduledAt).toLocaleString()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <AttendanceStatusBadge status={record.status} />
                  </TableCell>
                  <TableCell>
                    {record.checkedInAt
                      ? new Date(record.checkedInAt).toLocaleString()
                      : "N/A"}
                  </TableCell>
                  <TableCell>{record.notes || "N/A"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
