import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/session";
import { listAllEvents } from "@/lib/services/events";
import QrScannerClient from "./QrScannerClient";
import { timeOutWindow } from "@/lib/time";

export const metadata: Metadata = { title: "QR Scanner" };
export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  await requirePagePermission("scan.perform");
  const { events } = await listAllEvents(1, 100);
  const now = new Date().getTime();
  const within = (a: string, b: string) => now >= Date.parse(a) && now < Date.parse(b);

  // Published events that can still be scanned (time-out may stay open after the event ends).
  const scannable = events
    .filter((e) => e.status === "published" && now < Math.max(Date.parse(e.ends_at), Date.parse(timeOutWindow(e).closes), Date.parse(e.time_in_closes_at)))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const options = scannable.map((e) => ({ id: e.id, name: e.name }));

  // Default to the event whose scanning window is open right now.
  const live =
    scannable.find((e) => within(e.time_in_opens_at, e.time_in_closes_at)) ??
    scannable.find((e) => {
      const w = timeOutWindow(e);
      return within(w.opens, w.closes);
    }) ??
    scannable[0];
  return <QrScannerClient events={options} defaultEventId={live?.id} />;
}
