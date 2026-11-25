import { isSealed, open, seal } from "../lib/secretBox";
import { prisma } from "../db";
import { deleteGoogleEvent, upsertGoogleEvent } from "./googleCalendar";
import { deleteOutlookEvent, upsertOutlookEvent } from "./outlookCalendar";
import type { CalendarEventInput } from "./googleCalendar";
import type { Task } from "@prisma/client";

/**
 * Pushes a task marked `synced` to whichever cloud provider the user
 * connected. Apple is intentionally excluded here — that sync path writes
 * straight to the device's local calendar from the mobile app (expo-calendar
 * / EventKit), which this server has no access to.
 */
export async function syncTaskToCalendar(task: Task): Promise<{ externalEventId: string | null; externalProvider: string | null }> {
  if (!task.synced) return { externalEventId: null, externalProvider: null };

  const connection = await prisma.calendarConnection.findFirst({
    where: { userId: task.userId, provider: { in: ["google", "outlook"] } },
  });
  if (!connection || !connection.refreshToken) return { externalEventId: null, externalProvider: null };
  const refreshToken = await readRefreshToken(connection);

  const start = combineDateAndTime(task.date, task.time);
  const end = new Date(start.getTime() + task.duration * 60_000);
  const input: CalendarEventInput = {
    title: task.title,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    notes: task.notes,
    recurring: task.recurring,
  };

  const existingId = task.externalProvider === connection.provider ? task.externalEventId : null;
  const eventId =
    connection.provider === "google"
      ? await upsertGoogleEvent(refreshToken, existingId, input)
      : await upsertOutlookEvent(refreshToken, existingId, input);

  return { externalEventId: eventId, externalProvider: connection.provider };
}

export async function unsyncTaskFromCalendar(task: Task): Promise<void> {
  if (!task.externalEventId || !task.externalProvider) return;
  const connection = await prisma.calendarConnection.findFirst({ where: { userId: task.userId, provider: task.externalProvider } });
  if (!connection?.refreshToken) return;
  const refreshToken = await readRefreshToken(connection);
  if (task.externalProvider === "google") await deleteGoogleEvent(refreshToken, task.externalEventId);
  else if (task.externalProvider === "outlook") await deleteOutlookEvent(refreshToken, task.externalEventId);
}

/** La clé d'accès en clair ; une ancienne clé gardée en clair est chiffrée au passage. */
async function readRefreshToken(connection: { id: string; refreshToken: string | null; accessToken: string | null }): Promise<string> {
  const stored = connection.refreshToken!;
  if (!isSealed(stored)) {
    await prisma.calendarConnection.update({ where: { id: connection.id }, data: { refreshToken: seal(stored), accessToken: seal(connection.accessToken) } });
  }
  return open(stored);
}

function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
