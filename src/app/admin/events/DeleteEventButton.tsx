"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { deleteEventAction } from "./actions";

export default function DeleteEventButton({
  eventId,
  eventName,
  registrations,
  variant = "button",
}: {
  eventId: string;
  eventName: string;
  registrations: number;
  variant?: "button" | "icon";
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [pending, start] = useTransition();
  const matches = confirm.trim() === eventName.trim();

  function open() {
    setConfirm("");
    setReason("");
    setError(null);
    dialogRef.current?.showModal();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError({ field: "reason", message: "Give a reason of at least 5 characters." });
      document.getElementById(`del-reason-${eventId}`)?.focus();
      return;
    }
    if (!matches) {
      setError({ field: "confirm", message: "The name doesn't match. Type the event name exactly." });
      document.getElementById(`del-confirm-${eventId}`)?.focus();
      return;
    }
      start(async () => {
        const result = await deleteEventAction(eventId, confirm, reason);
        if (result.ok) {
          dialogRef.current?.close();
          router.push("/admin/events?deleted=1");
        } else {
        setError({ message: result.error, field: result.field });
        if (result.field === "reason") document.getElementById(`del-reason-${eventId}`)?.focus();
        else if (result.field === "confirm") document.getElementById(`del-confirm-${eventId}`)?.focus();
      }
    });
  }

  return (
    <>
      {variant === "icon" ? (
        <button type="button" onClick={open} className="btn-ghost w-11 h-11 p-0 text-danger-600 hover:bg-danger-50" aria-label={`Delete ${eventName}`}>
          <Trash2 className="w-[18px] h-[18px]" aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick={open} className="btn-danger btn-lg w-full sm:w-auto">
          <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete event
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`del-title-${eventId}`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[24px] p-0 bg-white text-ink shadow-2xl backdrop:bg-ink/60 backdrop:backdrop-blur-sm"
        onClick={(e) => e.target === dialogRef.current && !pending && dialogRef.current?.close()}
      >
        <form onSubmit={submit} className="p-5 sm:p-6 flex flex-col gap-4" noValidate>
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-full bg-danger-50 text-danger-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`del-title-${eventId}`} className="text-lg font-bold">Delete this event?</h2>
              <p className="text-sm text-[#4b6362] break-words">{eventName}</p>
            </div>
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className="btn-ghost w-11 h-11 p-0 -mr-2 -mt-2" aria-label="Close">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="rounded-2xl bg-danger-50 border border-danger-500/20 p-3.5 text-sm text-[#7a1f12]">
            This permanently removes the event, <strong>{registrations.toLocaleString()} registration{registrations === 1 ? "" : "s"}</strong>, their QR passes and attendance records.
            Students will lose access to this event&apos;s records. This cannot be undone. A record of the deletion is kept in the audit log.
          </div>

          <div>
            <label htmlFor={`del-reason-${eventId}`} className="label">Reason *</label>
            <input
              id={`del-reason-${eventId}`}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error?.field === "reason") setError(null);
              }}
              className="input"
              placeholder="e.g. Duplicate event created by mistake"
              aria-invalid={error?.field === "reason" ? true : undefined}
              aria-describedby={error?.field === "reason" ? `del-reason-err-${eventId}` : undefined}
              maxLength={500}
            />
            {error?.field === "reason" && (
              <p id={`del-reason-err-${eventId}`} className="field-error flex items-center gap-1.5" role="alert">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {error.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`del-confirm-${eventId}`} className="label">
              Type <span className="font-mono font-bold text-ink break-all">{eventName}</span> to confirm *
            </label>
            <input
              id={`del-confirm-${eventId}`}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (error?.field === "confirm") setError(null);
              }}
              className="input"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error?.field === "confirm" ? true : undefined}
              aria-describedby={error?.field === "confirm" ? `del-confirm-err-${eventId}` : undefined}
            />
            {error?.field === "confirm" && (
              <p id={`del-confirm-err-${eventId}`} className="field-error flex items-center gap-1.5" role="alert">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {error.message}
              </p>
            )}
          </div>

          {error && !error.field && <p role="alert" className="text-sm font-semibold text-danger-600">{error.message}</p>}

          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className="btn-secondary btn-lg">Keep event</button>
            <button type="submit" disabled={pending} className={clsx("btn-danger btn-lg", (!matches || reason.trim().length < 5) && "opacity-75")}>
              {pending ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Deleting…</> : <><Trash2 className="w-4 h-4" aria-hidden="true" /> Delete permanently</>}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
