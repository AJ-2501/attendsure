"use client";

import { useState } from "react";
import { Download, CheckCircle2, Loader2 } from "lucide-react";
import { exportQrToPhotos, type ExportQrOptions } from "@/lib/qr-export";
import { clsx } from "clsx";

interface SaveQrButtonProps extends ExportQrOptions {
  className?: string;
  variant?: "primary" | "secondary" | "subtle";
  buttonText?: string;
}

export default function SaveQrButton({
  className,
  variant = "secondary",
  buttonText,
  ...exportOptions
}: SaveQrButtonProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");

  async function handleExport() {
    if (status === "saving") return;
    setStatus("saving");

    const result = await exportQrToPhotos(exportOptions);

    if (result.success) {
      setStatus("saved");
      setFeedbackMessage("QR Exported!");
      setTimeout(() => {
        setStatus("idle");
        setFeedbackMessage("");
      }, 3000);
    } else {
      setStatus("idle");
    }
  }

  const defaultLabel = buttonText || "Export QR";

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={status === "saving"}
      aria-label="Export QR pass as PNG"
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-150 active:scale-[0.97] touch-manipulation select-none rounded-xl min-h-11 px-4",
        variant === "secondary" &&
          "bg-white hover:bg-slate-50 active:bg-slate-100 text-[#0b2e2f] border border-[#cfdedc] shadow-sm hover:border-brand-500 hover:text-brand-700",
        variant === "primary" &&
          "bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-sm",
        variant === "subtle" &&
          "bg-brand-50 hover:bg-brand-100 active:bg-brand-200 text-brand-800 border border-brand-200",
        status === "saved" && "!bg-success-50 !border-success-500/40 !text-success-800",
        className,
      )}
    >
      {status === "saving" ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" aria-hidden="true" />
          <span>Exporting…</span>
        </>
      ) : status === "saved" ? (
        <>
          <CheckCircle2 className="w-4 h-4 text-success-600" aria-hidden="true" />
          <span className="font-bold">{feedbackMessage || "QR Exported!"}</span>
        </>
      ) : (
        <>
          <Download className="w-4 h-4 text-brand-600 shrink-0" aria-hidden="true" />
          <span>{defaultLabel}</span>
        </>
      )}
    </button>
  );
}
