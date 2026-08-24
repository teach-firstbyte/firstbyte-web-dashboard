import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";
import { dateField, idParam } from "@/server/validation";

const attendanceStatus = z.enum(AttendanceStatus, {
  error: `Invalid status. Must be one of: ${Object.values(AttendanceStatus).join(", ")}`,
});

/**
 * The query string of GET /api/attendance.
 *
 * userId is accepted here but it is a *filter*, never an identity. A member who
 * sends someone else's id still gets their own rows, because
 * listAttendanceForViewer overwrites it. See src/server/viewer.ts.
 */
export const attendanceFilterSchema = z.object({
  meetingId: idParam.optional(),
  userId: idParam.optional(),
});

export type AttendanceFilter = z.infer<typeof attendanceFilterSchema>;

export const createAttendanceSchema = z.object({
  userId: idParam,
  meetingId: idParam,
  status: attendanceStatus,
  checkedInAt: dateField.nullish().transform((v) => v ?? null),
  checkedOutAt: dateField.nullish().transform((v) => v ?? null),
  notes: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
});

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;

export const updateAttendanceSchema = z
  .object({
    status: attendanceStatus,
    checkedInAt: dateField.nullable(),
    checkedOutAt: dateField.nullable(),
    notes: z.string().nullable(),
  })
  .partial()
  .refine(
    (v) => Object.keys(v).length > 0,
    "Provide at least one of: status, checkedInAt, checkedOutAt, notes",
  );

export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

/** The body of the QR check-in POST. The code is verified separately, by HMAC. */
export const checkInSchema = z.object({
  meetingId: idParam,
  code: z.string().min(1, "meetingId and code are required"),
});
