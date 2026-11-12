"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { AlertTriangle, Check, ClipboardPaste, Copy, Download, Eye, EyeOff, FileSpreadsheet, KeyRound, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import { DECRYPT_BATCH_MAX, ENVELOPE_PATTERN } from "@/lib/schemas";

type Mode = "csv" | "paste";
type FieldKey = "name" | "studentId" | "email" | "profileName" | "profileStudentId";
type Result = { field: FieldKey; value: string } | null;

const FIELD_LABEL: Record<FieldKey, string> = {
  name: "Name",
  studentId: "Student ID",
  email: "Email",
  profileName: "Name",
  profileStudentId: "Student ID",
};

/** Plaintext is kept in memory only, and only for this long. */
const AUTO_CLEAR_MS = 5 * 60_000;
const PREVIEW_ROWS = 50;
/** Keeps the first column (reference code) in view while a wide CSV preview scrolls sideways. */
const STICKY_COL = "sticky left-0 z-[1] bg-white shadow-[1px_0_0_#eef4f3]";
const ENVELOPE_GLOBAL = new RegExp(ENVELOPE_PATTERN.source.slice(1, -1), "g");
/** Per-tab only: admin accounts can be shared, so the name must not carry over to the next person on this device. */
const NAME_STORAGE_KEY = "attendsure.decryptedBy";
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

const noopSubscribe = () => () => {};
function readSavedName() {
  try { return sessionStorage.getItem(NAME_STORAGE_KEY) ?? ""; } catch { return ""; }
}

function validateName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return "Enter your full name so this decryption is attributed to you.";
  if (name.length > 80) return "Name is too long (max 80 characters).";
  if (!NAME_PATTERN.test(name)) return "Use letters, spaces, periods, apostrophes or hyphens only.";
  return null;
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF/LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const toCsv = (rows: string[][]) => rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
const isEnvelope = (s: string) => ENVELOPE_PATTERN.test(s.trim());
const shorten = (s: string) => (s.length > 22 ? `${s.slice(0, 12)}…${s.slice(-6)}` : s);
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

export default function DecryptClient() {
  const router = useRouter();
  const ids = { name: useId(), reason: useId(), paste: useId(), file: useId() };
  const [mode, setMode] = useState<Mode>("csv");
  // Prefill with the name typed earlier in this tab so repeat decryptions don't need retyping.
  const savedName = useSyncExternalStore(noopSubscribe, readSavedName, () => "");
  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? savedName;
  const [nameError, setNameError] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; rows: string[][] } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Map<string, Result> | null>(null);
  const [revealed, setRevealed] = useState(true);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState<string | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const envelopes = useMemo(() => {
    const found = mode === "csv"
      ? (file?.rows.slice(1).flat().filter(isEnvelope).map((s) => s.trim()) ?? [])
      : (pasted.match(ENVELOPE_GLOBAL) ?? []);
    return [...new Set(found)];
  }, [mode, file, pasted]);

  const clearResults = useCallback(() => {
    setResults(null);
    setExpiresAt(null);
    setCopied(null);
  }, []);

  // Auto-clear decrypted values so personal data doesn't linger on an unattended screen.
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= expiresAt) clearResults();
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt, clearResults]);

  async function loadFile(f: File | undefined) {
    clearResults();
    setFileError(null);
    if (!f) return;
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") {
      setFileError("Choose a .csv file exported from AttendSure.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setFileError("That file is larger than 10 MB. Export a single event at a time.");
      return;
    }
    const rows = parseCsv(await f.text());
    if (!rows.slice(1).flat().some(isEnvelope)) {
      setFile(null);
      setFileError("No encrypted values found in this file. Use the Export CSV button on the Attendance or Reports page.");
      return;
    }
    setFile({ name: f.name, rows });
  }

  async function decrypt(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const nameMsg = validateName(name);
    const reasonMsg = reason.trim().length < 5 ? "Say why you need this data (at least 5 characters)." : null;
    setNameError(nameMsg);
    setReasonError(reasonMsg);
    if (nameMsg || reasonMsg) {
      document.getElementById(nameMsg ? ids.name : ids.reason)?.focus();
      return;
    }
    if (envelopes.length === 0) return;
    const decryptedBy = name.trim().replace(/\s+/g, " ");

    const out = new Map<string, Result>();
    setProgress({ done: 0, total: envelopes.length });
    try {
      for (let i = 0; i < envelopes.length; i += DECRYPT_BATCH_MAX) {
        const batch = envelopes.slice(i, i + DECRYPT_BATCH_MAX);
        const res = await fetch("/api/records/decrypt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: batch, decryptedBy, reason: reason.trim() }),
          cache: "no-store",
        });
        const json = await res.json();
        if (!json.ok) {
          const serverName = json.error?.fields?.decryptedBy?.[0];
          const serverReason = json.error?.fields?.reason?.[0];
          if (serverName || serverReason) {
            setNameError(serverName ?? null);
            setReasonError(serverReason ?? null);
            document.getElementById(serverName ? ids.name : ids.reason)?.focus();
          } else setFormError(json.error?.message ?? "Decryption failed. Try again.");
          return;
        }
        (json.data.results as Result[]).forEach((r, j) => out.set(batch[j], r));
        setProgress({ done: Math.min(i + batch.length, envelopes.length), total: envelopes.length });
      }
      try { sessionStorage.setItem(NAME_STORAGE_KEY, decryptedBy); } catch { /* non-essential */ }
      setResults(out);
      setRevealed(true);
      router.refresh(); // pull this run into "Recent decryptions"
      setExpiresAt(Date.now() + AUTO_CLEAR_MS);
      setNow(Date.now());
      requestAnimationFrame(() => resultsRef.current?.focus());
    } catch {
      setFormError("Network error — nothing was decrypted. Check your connection and try again.");
    } finally {
      setProgress(null);
    }
  }

  const failed = results ? [...results.values()].filter((r) => !r).length : 0;

  // CSV mode: same table with encrypted cells swapped for plaintext and "_encrypted" dropped from headers.
  const decryptedRows = useMemo(() => {
    if (!results || !file) return null;
    const [header, ...body] = file.rows;
    const encryptedCols = new Set(header.map((_, c) => c).filter((c) => body.some((r) => r[c] && isEnvelope(r[c]))));
    return [
      header.map((h, c) => (encryptedCols.has(c) ? h.replace(/_encrypted$/i, "") : h)),
      ...body.map((r) => r.map((cell) => {
        if (!isEnvelope(cell)) return cell;
        const hit = results.get(cell.trim());
        return hit ? hit.value : "[could not decrypt]";
      })),
    ];
  }, [results, file]);

  function download() {
    if (!decryptedRows || !file) return;
    const blob = new Blob(["﻿" + toCsv(decryptedRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: file.name.replace(/\.csv$/i, "") + "-decrypted.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
    } catch {
      setFormError("Couldn't access the clipboard. Select the text and copy it manually.");
    }
  }

  const remaining = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const mmss = `${Math.floor(remaining / 60_000)}:${String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0")}`;
  const busy = progress !== null;
  const hidden = "••••••••";

  return (
    <div className="space-y-6">
      <form onSubmit={decrypt} className="card p-4 sm:p-6 space-y-5" noValidate>
        {/* Source */}
        <fieldset className="space-y-3">
          <legend className="label mb-2">1. Add encrypted data</legend>
          <div role="group" aria-label="Input method" className="inline-flex rounded-xl bg-[#eef4f3] p-1 gap-1">
            {([["csv", "Upload CSV", FileSpreadsheet], ["paste", "Paste values", ClipboardPaste]] as const).map(([m, label, Icon]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => { setMode(m); clearResults(); }}
                className={clsx(
                  "inline-flex items-center gap-2 min-h-11 px-4 rounded-lg text-sm font-semibold transition-colors",
                  mode === m ? "bg-white text-ink shadow-sm" : "text-[#4b6362] hover:text-ink",
                )}
              >
                <Icon className="w-4 h-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>

          {mode === "csv" ? (
            file ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#cfdedc] bg-[#f8fbfa] p-3">
                <FileSpreadsheet className="w-8 h-8 text-brand-600 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink truncate">{file.name}</p>
                  <p className="text-xs text-[#4b6362]">{plural(file.rows.length - 1, "row")} · {plural(envelopes.length, "encrypted value")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); clearResults(); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="btn-ghost w-11 h-11 p-0 shrink-0"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <label
                htmlFor={ids.file}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}
                className={clsx(
                  "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors",
                  "focus-within:outline focus-within:outline-2 focus-within:outline-brand-500 focus-within:outline-offset-2",
                  dragging ? "border-brand-500 bg-brand-50" : "border-[#cfdedc] hover:border-brand-500 hover:bg-[#f8fbfa]",
                  fileError && "border-danger-600",
                )}
              >
                <Upload className="w-7 h-7 text-brand-600" aria-hidden="true" />
                <span className="font-semibold text-ink">Drop an exported CSV here, or <span className="text-brand-600 underline">browse</span></span>
                <span className="text-xs text-[#4b6362]">Use Export CSV on the Attendance or Reports page. Max 10 MB.</span>
                <input
                  id={ids.file}
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-describedby={fileError ? `${ids.file}-err` : undefined}
                  onChange={(e) => loadFile(e.target.files?.[0])}
                />
              </label>
            )
          ) : (
            <div>
              <label htmlFor={ids.paste} className="sr-only">Encrypted values</label>
              <textarea
                id={ids.paste}
                value={pasted}
                onChange={(e) => { setPasted(e.target.value); clearResults(); }}
                rows={5}
                spellCheck={false}
                autoComplete="off"
                placeholder={"v1.q9Zk2W…\nv1.Hc81pL…"}
                className="input font-mono text-sm resize-y min-h-32"
                aria-describedby={`${ids.paste}-hint`}
              />
              <p id={`${ids.paste}-hint`} className="text-xs text-[#4b6362] mt-1">
                One per line, or paste whole rows — anything starting with <code className="font-mono">v1.</code> is picked up.{" "}
                <span className="font-semibold text-ink" aria-live="polite">{plural(envelopes.length, "value")} detected.</span>
              </p>
            </div>
          )}
          {fileError && mode === "csv" && <p id={`${ids.file}-err`} className="field-error" role="alert">{fileError}</p>}
        </fieldset>

        {/* Accountability: who is decrypting and why */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor={ids.name} className="label">
              2. Your full name <span className="text-danger-600" aria-hidden="true">*</span>
            </label>
            <input
              id={ids.name}
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
              onBlur={() => { if (name.trim()) setNameError(validateName(name)); }}
              maxLength={80}
              required
              autoComplete="name"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="e.g. Juan Dela Cruz"
              className="input text-base sm:text-sm"
              aria-invalid={!!nameError}
              aria-describedby={`${ids.name}-hint${nameError ? ` ${ids.name}-err` : ""}`}
            />
            {nameError
              ? <p id={`${ids.name}-err`} className="field-error" role="alert">{nameError}</p>
              : <p id={`${ids.name}-hint`} className="text-xs text-[#4b6362] mt-1">Shown in Recent decryptions. Remembered in this tab only.</p>}
          </div>
          <div className="min-w-0">
            <label htmlFor={ids.reason} className="label">
              3. Reason for access <span className="text-danger-600" aria-hidden="true">*</span>
            </label>
            <input
              id={ids.reason}
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (reasonError) setReasonError(null); }}
              maxLength={500}
              required
              enterKeyHint="go"
              placeholder="e.g. Verifying attendance for Dean's office report"
              className="input text-base sm:text-sm"
              aria-invalid={!!reasonError}
              aria-describedby={`${ids.reason}-hint${reasonError ? ` ${ids.reason}-err` : ""}`}
            />
            {reasonError
              ? <p id={`${ids.reason}-err`} className="field-error" role="alert">{reasonError}</p>
              : <p id={`${ids.reason}-hint`} className="text-xs text-[#4b6362] mt-1">Saved to the audit log with your name, as required by the Data Privacy Act of 2012.</p>}
          </div>
        </div>

        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-50 text-danger-600 text-sm p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {formError}
          </div>
        )}

        <button type="submit" disabled={busy || envelopes.length === 0} className="btn-primary w-full sm:w-auto gap-2">
          {progress ? (
            <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Decrypting {progress.done.toLocaleString()} of {progress.total.toLocaleString()}…</>
          ) : (
            <><KeyRound className="w-4 h-4" aria-hidden="true" /> {envelopes.length ? `Decrypt ${plural(envelopes.length, "value")}` : "Decrypt"}</>
          )}
        </button>
      </form>

      {results && (
        <section className="card overflow-hidden" aria-labelledby="decrypt-results">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-[#eef4f3]">
            <div className="flex-1 min-w-0">
              <h2 id="decrypt-results" ref={resultsRef} tabIndex={-1} className="font-semibold text-ink outline-none">
                {plural(results.size - failed, "value")} decrypted
                {failed > 0 && <span className="badge badge-red ml-2">{failed} couldn&apos;t be verified</span>}
              </h2>
              <p className="text-xs text-[#4b6362] flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Clears automatically in <span className="font-mono tabular-nums" aria-hidden="true">{mmss}</span>
                <span className="sr-only">{Math.ceil(remaining / 60_000)} minutes</span>
                <button type="button" onClick={() => setExpiresAt(Date.now() + AUTO_CLEAR_MS)} className="text-brand-600 font-semibold hover:underline ml-1">Extend</button>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRevealed((r) => !r)} className="btn-secondary btn-sm gap-2" aria-pressed={!revealed}>
                {revealed ? <><EyeOff className="w-4 h-4" aria-hidden="true" /> Hide</> : <><Eye className="w-4 h-4" aria-hidden="true" /> Show</>}
              </button>
              {decryptedRows ? (
                <button type="button" onClick={download} className="btn-primary btn-sm gap-2">
                  <Download className="w-4 h-4" aria-hidden="true" /> Download decrypted CSV
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => copy([...results.values()].map((r) => r?.value ?? "").join("\n"), "all")}
                  className="btn-primary btn-sm gap-2"
                >
                  {copied === "all" ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  {copied === "all" ? "Copied" : "Copy all"}
                </button>
              )}
              <button type="button" onClick={clearResults} className="btn-ghost btn-sm gap-2">
                <X className="w-4 h-4" aria-hidden="true" /> Clear
              </button>
            </div>
          </div>

          {failed > 0 && (
            <p className="px-4 py-2 text-xs text-[#4b6362] bg-warning-50 border-b border-[#eef4f3]">
              Values that couldn&apos;t be verified were changed after export or come from a different AttendSure installation.
            </p>
          )}

          <div className="overflow-x-auto max-h-[60vh]">
            {decryptedRows ? (
              <table className="table-auto w-full">
                <thead className="sticky top-0 bg-white">
                  <tr>{decryptedRows[0].map((h, i) => <th key={i} className={clsx("whitespace-nowrap", i === 0 && STICKY_COL)}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {decryptedRows.slice(1, PREVIEW_ROWS + 1).map((r, i) => (
                    <tr key={i}>
                      {r.map((cell, c) => {
                        const wasEncrypted = isEnvelope(file!.rows[i + 1][c] ?? "");
                        return (
                          <td key={c} className={clsx("text-sm whitespace-nowrap", wasEncrypted ? "font-semibold text-ink" : "text-[#4b6362]", c === 0 && STICKY_COL)}>
                            {wasEncrypted && !revealed ? <span aria-label="Hidden">{hidden}</span> : cell}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="table-auto w-full">
                <thead className="sticky top-0 bg-white">
                  <tr><th>Field</th><th className="hidden sm:table-cell">Encrypted</th><th>Decrypted</th><th><span className="sr-only">Copy</span></th></tr>
                </thead>
                <tbody>
                  {[...results].map(([env, r]) => (
                    <tr key={env}>
                      <td>{r ? <span className="badge badge-blue">{FIELD_LABEL[r.field]}</span> : <span className="badge badge-red">Invalid</span>}</td>
                      <td className="hidden sm:table-cell font-mono text-xs text-[#4b6362] whitespace-nowrap" title={env}>{shorten(env)}</td>
                      <td className="text-sm font-semibold text-ink break-words">
                        {r ? (revealed ? r.value : <span aria-label="Hidden">{hidden}</span>) : <span className="font-normal text-danger-600">Couldn&apos;t verify</span>}
                      </td>
                      <td className="w-12">
                        {r && (
                          <button type="button" onClick={() => copy(r.value, env)} className="btn-ghost w-11 h-11 p-0" aria-label={`Copy ${FIELD_LABEL[r.field].toLowerCase()}`}>
                            {copied === env ? <Check className="w-4 h-4 text-success-700" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {decryptedRows && decryptedRows.length - 1 > PREVIEW_ROWS && (
            <p className="px-4 py-3 border-t border-[#eef4f3] text-xs text-[#4b6362]">
              Showing {PREVIEW_ROWS} of {(decryptedRows.length - 1).toLocaleString()} rows. Download the CSV for the full list.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
