import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/session";
import EventFormClient from "../EventFormClient";
import { createEventAction } from "../actions";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requirePagePermission("events.manage");
  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-fade-up">
      <div className="flex flex-col gap-2">
        <Link href="/admin/events" className="self-start -ml-2 min-h-11 pl-1 pr-3 rounded-xl inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:bg-brand-50">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" /> All events
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-ink">New event</h1>
        <p className="text-[#4b6362] text-sm">Create a College of Nursing event. Save as Draft until it&apos;s ready for students.</p>
      </div>
      <EventFormClient onSubmit={createEventAction} submitLabel="Create event" />
    </div>
  );
}
