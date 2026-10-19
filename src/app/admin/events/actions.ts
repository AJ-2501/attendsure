"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { createEvent, deleteEvent, getEventById, updateEvent } from "@/lib/services/events";
import { eventSchema } from "@/lib/schemas";
import { log } from "@/lib/logger";
import type { EventFormResult } from "./EventFormClient";

function authFailure(err: unknown): EventFormResult {
  if (err instanceof AuthError) return { ok: false, error: err.status === 401 ? "Your session expired. Sign in again." : "You don't have permission to manage events." };
  log.error("event_action_failed", { error: err instanceof Error ? err.message : "unknown" });
  return { ok: false, error: "Could not save the event. Please try again." };
}

function validation(data: unknown) {
  const parsed = eventSchema.safeParse(data);
  if (parsed.success) return { parsed: parsed.data };
  return { failure: { ok: false, error: "Please fix the highlighted fields.", fields: parsed.error.flatten().fieldErrors as Record<string, string[]> } satisfies EventFormResult };
}

function refresh(id?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/events");
  if (id) {
    revalidatePath(`/admin/events/${id}`);
    revalidatePath(`/events/${id}`);
  }
}

export async function createEventAction(data: unknown): Promise<EventFormResult> {
  try {
    const staff = await requirePermission("events.manage");
    const v = validation(data);
    if (v.failure) return v.failure;
    const event = await createEvent(v.parsed, staff.profileId);
    refresh(event.id);
    return { ok: true, id: event.id };
  } catch (err) {
    return authFailure(err);
  }
}

export async function updateEventAction(id: string, data: unknown): Promise<EventFormResult> {
  try {
    const staff = await requirePermission("events.manage");
    const v = validation(data);
    if (v.failure) return v.failure;
    const event = await updateEvent(id, v.parsed, staff.profileId);
    refresh(event.id);
    return { ok: true, id: event.id };
  } catch (err) {
    return authFailure(err);
  }
}

export type DeleteActionResult = { ok: true } | { ok: false; error: string; field?: "confirm" | "reason" };

export async function deleteEventAction(id: string, confirmName: string, reason: string): Promise<DeleteActionResult> {
  try {
    const staff = await requirePermission("events.manage");
    const event = await getEventById(id);
    if (!event) return { ok: false, error: "This event no longer exists." };
    if (confirmName.trim() !== event.name.trim()) return { ok: false, field: "confirm", error: "The name doesn't match. Type the event name exactly." };
    if (reason.trim().length < 5) return { ok: false, field: "reason", error: "Give a reason of at least 5 characters." };

    const result = await deleteEvent(id, staff.profileId, reason.trim());
    if (!result.ok) {
      const msg = {
        NOT_FOUND: "This event no longer exists.",
        REASON_REQUIRED: "Give a reason of at least 5 characters.",
        NOT_MIGRATED: "Deleting events needs the latest database migration (20261019000003). Ask your administrator to run it.",
        ERROR: "Could not delete the event. Please try again.",
      }[result.code];
      return { ok: false, error: msg };
    }
    refresh(id);
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "You don't have permission to delete events." };
    log.error("event_delete_failed", { error: err instanceof Error ? err.message : "unknown" });
    return { ok: false, error: "Could not delete the event. Please try again." };
  }
}
