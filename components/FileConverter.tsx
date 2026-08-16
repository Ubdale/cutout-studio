"use client";

import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { prettyBytes } from "@/lib/image";
import BulkPanel, { type BulkResult } from "./BulkPanel";

export type SheetFmt = "xlsx" | "csv" | "json";

const FMT_LABEL: Record<SheetFmt, string> = { xlsx: "Excel (.xlsx)", csv: "CSV", json: "JSON" };
const FMT_EXT: Record<SheetFmt, string> = { xlsx: "xlsx", csv: "csv", json: "json" };
const FMT_MIME: Record<SheetFmt, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  json: "application/json",
};

function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

/**
 * Reads any supported input (xlsx/xls/csv/json) into a SheetJS workbook.
 * cellDates:true keeps dates as real dates instead of Excel's serial-number
 * encoding, so CSV/JSON output shows an actual date, not a number like 45123.
 */
async function fileToWorkbook(file: File): Promise<XLSX.WorkBook> {
  const ext = extOf(file.name);

  if (ext === "json") {
    const text = await file.text();
    const data = JSON.parse(text);
    const rows = Array.isArray(data) ? data : [data];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return wb;
  }

  if (ext === "csv") {
    const text = await file.text();
    return XLSX.read(text, { type: "string", cellDates: true });
  }

  // xlsx, xls, ods, and anything else SheetJS can sniff
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array", cellDates: true });
}

/**
 * Writes a workbook to the requested format. CSV/JSON can only hold one
 * sheet — if the source had more than one, only the first is exported and
 * the caller is told so (surfaced in the UI as a warning, not silently).
 */
function workbookToBlob(wb: XLSX.WorkBook, fmt: SheetFmt): { blob: Blob; multiSheetDropped: boolean } {
  const multiSheetDropped = fmt !== "xlsx" && wb.SheetNames.length > 1;

  if (fmt === "xlsx") {
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return { blob: new Blob([out], { type: FMT_MIME.xlsx }), multiSheetDropped };
  }

  const ws = wb.Sheets[wb.SheetNames[0]];

  if (fmt === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return { blob: new Blob([csv], { type: FMT_MIME.csv }), multiSheetDropped };
  }

  // json
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  const json = JSON.stringify(rows, null, 2);
  return { blob: new Blob([json], { type: FMT_MIME.json }), multiSheetDropped };
}

async function convertFile(file: File, fmt: SheetFmt): Promise<{ blob: Blob; multiSheetDropped: boolean; sheets: number; rows: number }> {
  const wb = await fileToWorkbook(file);
  const { blob, multiSheetDropped } = workbookToBlob(wb, fmt);
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const range = firstSheet["!ref"] ? XLSX.utils.decode_range(firstSheet["!ref"]) : null;
  const rows = range ? range.e.r - range.s.r : 0;
  return { blob, multiSheetDropped, sheets: wb.SheetNames.length, rows };
}

const ACCEPT = ".xlsx,.xls,.csv,.json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/json";

function isSupported(file: File): boolean {
  return ["xlsx", "xls", "csv", "json"].includes(extOf(file.name));
}

export default function FileConverter() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [fmt, setFmt] = useState<SheetFmt>("xlsx");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [out, setOut] = useState<{ url: string; blob: Blob; sheets: number; rows: number } | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSupported(file)) {
        setError("That file type isn't supported. Use .xlsx, .xls, .csv or .json.");
        return;
      }
      setError("");
      setWarning("");
      setBusy(true);
      setName(file.name);
      try {
        const { blob, multiSheetDropped, sheets, rows } = await convertFile(file, fmt);
        setOut((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url: URL.createObjectURL(blob), blob, sheets, rows };
        });
        if (multiSheetDropped) {
          setWarning(
            `This file has ${sheets} sheets — ${FMT_LABEL[fmt]} can only hold one, so only the first sheet was exported.`
          );
        }
      } catch (err) {
        setError(err instanceof Error ? `Could not convert this file: ${err.message}` : "Could not convert this file.");
        setOut(null);
      } finally {
        setBusy(false);
      }
    },
    [fmt]
  );

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const download = () => {
    if (!out) return;
    const a = document.createElement("a");
    a.href = out.url;
    a.download = name.replace(/\.[^.]+$/, "") + "." + FMT_EXT[fmt];
    a.click();
  };

  const reset = () => {
    if (out) URL.revokeObjectURL(out.url);
    setOut(null);
    setName("");
    setError("");
    setWarning("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const bulkProcess = useCallback(
    async (file: File): Promise<BulkResult> => {
      const { blob } = await convertFile(file, fmt);
      return { blob, ext: FMT_EXT[fmt] };
    },
    [fmt]
  );

  return (
    <div className="tool">
      <div className="mode-row">
        <button type="button" className={`mode-btn${mode === "single" ? " on" : ""}`} onClick={() => setMode("single")}>Single file</button>
        <button type="button" className={`mode-btn${mode === "bulk" ? " on" : ""}`} onClick={() => setMode("bulk")}>Bulk (multiple)</button>
      </div>

      <div className="fmt-row">
        {(Object.keys(FMT_LABEL) as SheetFmt[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`fmt-btn${fmt === f ? " on" : ""}`}
            onClick={() => { setFmt(f); if (mode === "single" && name) reset(); }}
          >
            To {FMT_LABEL[f]}
          </button>
        ))}
      </div>

      {mode === "bulk" ? (
        <BulkPanel
          process={bulkProcess}
          zipName={`converted-${fmt}.zip`}
          accept={ACCEPT}
          filter={isSupported}
          label="spreadsheets"
          hint={`Every file converted to ${FMT_LABEL[fmt]} · .xlsx, .xls, .csv and .json accepted`}
        />
      ) : !name ? (
        <div
          className={`drop${over ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        >
          <div className="drop-mark checker" />
          <h2 className="display">Drop a spreadsheet to convert it</h2>
          <p>.xlsx, .xls, .csv or .json · it never leaves your browser</p>
          <button className="pick" type="button">Choose file</button>
          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            accept={ACCEPT}
            onChange={onInput}
          />
        </div>
      ) : (
        <div className="stage">
          <div className="meta mono">
            <span>{name}</span>
            {out && (
              <>
                <span className="dot" />
                <span>{out.sheets} sheet{out.sheets === 1 ? "" : "s"}</span>
                <span className="dot" />
                <span>{out.rows} rows</span>
                <span className="dot" />
                <span>{prettyBytes(out.blob.size)}</span>
              </>
            )}
          </div>

          {error && <div className="error">{error}</div>}
          {warning && !error && <div className="error">{warning}</div>}

          {busy && (
            <div className="status">
              <span className="spinner" />
              <span>Converting…</span>
            </div>
          )}

          <div className="actions">
            {out && !busy && (
              <button className="btn primary" type="button" onClick={download}>
                Download {FMT_LABEL[fmt]}
              </button>
            )}
            <button className="btn" type="button" onClick={reset}>
              {error ? "Try again" : "New file"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
