import { withBasePath } from "@/lib/paths";
import type { TaskStatusValue } from "@/lib/enums";

// The board's calls to /api/tasks. Each throws an Error carrying the server's
// own sentence (the API answers 400/403 with { error }), so a refusal reads
// the same in a toast as the rule that caused it.

/** The body POST /api/tasks takes. */
export type TaskInput = {
  title: string;
  ownerId: number;
  dueDate: string;
  status: TaskStatusValue;
  teamId: number | null;
  meetingId: number | null;
  notes: string | null;
};

async function send(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  fallback: string,
) {
  const res = await fetch(withBasePath(path), {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? fallback);
  }
}

export function createTask(input: TaskInput) {
  return send("/api/tasks", "POST", input, "That task could not be added.");
}

/** A partial update. The owner may send `status` alone. */
export function updateTask(id: number, changes: Partial<TaskInput>) {
  return send(`/api/tasks/${id}`, "PATCH", changes, "That change didn't save.");
}

export function deleteTask(id: number) {
  return send(
    `/api/tasks/${id}`,
    "DELETE",
    undefined,
    "That task could not be deleted.",
  );
}
