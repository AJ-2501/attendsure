"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export interface Row { label: string; registered: number; timed_in: number; timed_out: number; }

/** The recharts part of a report card; loaded on demand so recharts stays out of the page bundle. */
export default function AttendanceBarChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="registered" name="Registered" fill="#93c5fd" radius={[3, 3, 0, 0]} />
        <Bar dataKey="timed_in" name="Timed In" fill="#4f8ef7" radius={[3, 3, 0, 0]} />
        <Bar dataKey="timed_out" name="Timed Out" fill="#16a34a" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
