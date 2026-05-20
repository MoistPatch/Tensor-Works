"use client";

import { useState, useRef, useCallback } from "react";

const REQUIRED_COLUMNS = [
  "email",
  "first_name",
  "last_name",
  "organisation",
  "role_title",
  "role_source_url",
  "role_relevance_note",
] as const;

type Row = Record<string, string>;

interface ParseResult {
  headers: string[];
  rows: Row[];
  validRows: Row[];
  invalidRows: Array<{ row: Row; reasons: string[] }>;
}

function parseCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { headers: [], rows: [], validRows: [], invalidRows: [] };
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
    const row: Row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  const validRows: Row[] = [];
  const invalidRows: Array<{ row: Row; reasons: string[] }> = [];

  for (const row of rows) {
    const reasons: string[] = [];
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      reasons.push("Invalid or missing email");
    }
    for (const col of REQUIRED_COLUMNS) {
      if (!(col in row)) {
        reasons.push(`Missing column: ${col}`);
      }
    }
    if (reasons.length > 0) {
      invalidRows.push({ row, reasons });
    } else {
      validRows.push(row);
    }
  }

  return { headers, rows, validRows, invalidRows };
}

export function ImportForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      setImportResult(null);
      setErrorMsg(null);

      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        setParseResult(parseCSV(text));
      };
      reader.readAsText(file);
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (!parseResult || parseResult.validRows.length === 0) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/subscribers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parseResult.validRows }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Import failed");
      }
      const data = await res.json();
      setImportResult({ created: data.created ?? 0, errors: data.errors ?? 0 });
      setParseResult(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }, [parseResult]);

  const previewRows = parseResult?.rows.slice(0, 10) ?? [];

  return (
    <div className="space-y-5">
      {/* File input */}
      <div>
        <label className="block text-sm font-medium text-[var(--tw-dark)] mb-2">
          CSV file
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-[var(--tw-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[var(--tw-blue)] file:text-white hover:file:opacity-90 cursor-pointer"
        />
        {fileName && (
          <p className="mt-1 text-xs text-[var(--tw-muted)]">Selected: {fileName}</p>
        )}
      </div>

      {/* Import result */}
      {importResult && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Import complete: {importResult.created.toLocaleString("en-AU")} contacts created
          {importResult.errors > 0 && `, ${importResult.errors} errors`}.
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Validation summary */}
      {parseResult && (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm">
            <span className="text-green-700 font-medium">
              ✓ {parseResult.validRows.length} valid row{parseResult.validRows.length !== 1 ? "s" : ""}
            </span>
            {parseResult.invalidRows.length > 0 && (
              <span className="text-red-700 font-medium">
                ✗ {parseResult.invalidRows.length} invalid row{parseResult.invalidRows.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {parseResult.invalidRows.length > 0 && (
            <details className="text-xs text-red-700 bg-red-50 rounded-lg border border-red-200 p-3">
              <summary className="cursor-pointer font-medium">Show invalid rows</summary>
              <ul className="mt-2 space-y-1">
                {parseResult.invalidRows.slice(0, 20).map((item, i) => (
                  <li key={i}>
                    <span className="font-mono">{item.row.email || "(no email)"}</span>:{" "}
                    {item.reasons.join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Preview table */}
          {previewRows.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--tw-muted)] mb-2">
                Preview (first {previewRows.length} row{previewRows.length !== 1 ? "s" : ""})
              </p>
              <div className="overflow-x-auto rounded-lg border border-[var(--tw-border)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--tw-bg)] border-b border-[var(--tw-border)]">
                      {parseResult.headers.map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 font-medium text-[var(--tw-muted)] whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-[var(--tw-border)] last:border-0 hover:bg-[var(--tw-bg)]"
                      >
                        {parseResult.headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-[var(--tw-dark)] max-w-[200px] truncate">
                            {row[h] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confirm import */}
          {parseResult.validRows.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-6 py-2.5 rounded-lg bg-[var(--tw-blue)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {importing
                ? "Importing…"
                : `Import ${parseResult.validRows.length.toLocaleString("en-AU")} contact${parseResult.validRows.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
