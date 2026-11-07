"use client";
import dynamic from "next/dynamic";
import type { Row } from "./AttendanceBarChart";

// recharts loads in its own chunk; the reserved 220px keeps the card from shifting while it arrives.
const AttendanceBarChart = dynamic(() => import("./AttendanceBarChart"), {
  ssr: false,
  loading: () => <div className="h-[220px]" aria-hidden="true" />,
});

interface Props { sectionData: Row[]; deptData: Row[]; yearData: Row[]; }

function AttendanceBar({ data, title }: { data: Row[]; title: string }) {
  if (!data.length) return null;
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-slate-700 mb-4">{title}</h3>
      <AttendanceBarChart data={data} />
    </div>
  );
}

export default function ReportsCharts({ sectionData, deptData, yearData }: Props) {
  return (
    <div className="space-y-6">
      <AttendanceBar data={sectionData} title="By Section" />
      <AttendanceBar data={deptData} title="By Department" />
      <AttendanceBar data={yearData} title="By Year Level" />
    </div>
  );
}
