import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { template: "%s · AttendSure", default: "AttendSure – College of Nursing Attendance" },
  description:
    "AttendSure is the College of Nursing's secure event attendance system with QR check-in and a real-time dashboard.",
  keywords: ["attendance", "college of nursing", "QR code", "student", "check-in"],
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AttendSure", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0B2E2F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
