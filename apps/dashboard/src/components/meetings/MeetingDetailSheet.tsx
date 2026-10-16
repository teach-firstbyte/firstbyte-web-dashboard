"use client";

import { AttendanceStatusBadge } from "@/components/AttendanceStatusBadge";
import { DetailSheet } from "@/components/ui/detail-sheet";
import {
  DetailEmpty,
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/ui/detail";
import { formatLongDateTime, formatTime } from "@/lib/format";
import { audienceLabel, meetingTypeLabel } from "@/lib/meetings";
import type { Meeting } from "@/types/dashboard";

interface MeetingDetailSheetProps {
  meeting: Meeting | null;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}

export function MeetingDetailSheet({
  meeting,
  onOpenChange,
  onCloseAutoFocus,
}: MeetingDetailSheetProps) {
  return (
    <DetailSheet
      record={meeting}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title={(m) => m.title}
      description={(m) =>
        `${meetingTypeLabel(m.type)} · ${formatLongDateTime(m.scheduledAt)}`
      }
    >
      {(m) => {
        const count = (status: string) =>
          m.attendance.filter((record) => record.status === status).length;

        return (
          <>
            {/* Type and time live in the description above. The id and the
                created time are bookkeeping, so they are not shown. */}
            <DetailSection title="Overview">
              <DetailGrid>
                <DetailField
                  label="Description"
                  value={m.description}
                  className="sm:col-span-2"
                />
                <DetailField label="Location" value={m.location} />
                <DetailField
                  label="Who's invited"
                  value={audienceLabel(m.team)}
                />
                <DetailField
                  label="Required"
                  value={m.isRequired ? "Yes" : "No"}
                />
                <DetailField label="Max capacity" value={m.maxCapacity} />
              </DetailGrid>
            </DetailSection>

            <DetailSection title={`Attendance (${m.attendance.length})`}>
              {m.attendance.length === 0 ? (
                <DetailEmpty>
                  No attendance records for this meeting.
                </DetailEmpty>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {count("PRESENT")} present · {count("EXCUSED")} excused ·{" "}
                    {count("ABSENT")} absent
                  </p>
                  <ul className="space-y-2">
                    {m.attendance.map((record) => (
                      <li
                        key={record.id}
                        className="space-y-1 rounded-md border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {record.user.name ?? record.user.email}
                            </div>
                            {record.user.name && (
                              <div className="truncate text-xs text-muted-foreground">
                                {record.user.email}
                              </div>
                            )}
                          </div>
                          <AttendanceStatusBadge status={record.status} />
                        </div>
                        {/* Only show the lines that have something to say, so an
                            absent member's card is not two empty dashes. */}
                        {record.checkedInAt && (
                          <p className="text-xs text-muted-foreground">
                            Checked in at {formatTime(record.checkedInAt)}
                          </p>
                        )}
                        {record.notes && (
                          <p className="text-sm break-words">{record.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </DetailSection>
          </>
        );
      }}
    </DetailSheet>
  );
}
