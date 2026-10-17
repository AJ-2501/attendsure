import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/session";
import { listAllEvents } from "@/lib/services/events";
import QrScannerClient from "./QrScannerClient";
import { effectiveStatus } from "@/lib/time";

export const metadata: Metadata = { title: "QR Scanner" };

export default async function ScannerPage() {
  await requirePagePermission("scan.perform");
  const { events } = await listAllEvents(1, 50);
  const now = new Date();
  const options = events
    .filter((e) => { const s = effectiveStatus(e, now); return s === "ongoing" || s === "open" || s === "upcoming"; })
    .map((e) => ({ id: e.id, name: e.name }));
  const defaultId = options[0]?.id;
  return <QrScannerClient events={options} defaultEventId={defaultId} />;
}
