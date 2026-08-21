"use client";

import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { prettyBytes } from "@/lib/image";
import BulkPanel, { type BulkResult } from "./BulkPanel";

export type ConvFmt = "xlsx" | "csv" | "json" | "pdf";

const FMT_LABEL: Record<ConvFmt, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV",
  json: "JSON",
  pdf: "PDF",
};
const FMT_EXT: Record<ConvFmt, string> = { xlsx: "xlsx", csv: "csv", json: "json", pdf: "pdf" };
const FMT_MIME: Record<ConvFmt, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  json: "application/json",
  pdf: "application/pdf",
};

function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

/**
 * PDFs don't tag their content as "this is a table" — there's no structural
 * markup like a spreadsheet has. This reconstructs one by reading each text
 * fragment's on-page (x, y) position and clustering fragments that share a
 * y-coordinate into a row, then ordering left-to-right within the row by x.
 * That works well for PDFs that were exported *from* a spreadsheet or report
 * generator (clean grid alignment) — it will do a poor job on scanned pages
 * (no text layer at all — this can't OCR) or free-flowing multi-column text
 * that only looks tabular. There's no reliable way to detect which case
 * you're in ahead of time, so the UI says this plainly rather than
 * pretending every PDF converts equally well.
 */
async function pdfToRows(file: File): Promise<string[][]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const rows: string[][] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    type Frag = { x: number; y: number; str: string };
    const frags: Frag[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      frags.push({ x: item.transform[4], y: item.transform[5], str: item.str });
    }
    if (!frags.length) continue;

    // group into rows: fragments within ~4px of vertical alignment are the
    // same row (PDF y-axis points up, so sort descending = top to bottom)
    frags.sort((a, b) => b.y - a.y || a.x - b.x);
    const rowGroups: Frag[][] = [];
    for (const f of frags) {
      const last = rowGroups[rowGroups.length - 1];
      if (last && Math.abs(last[0].y - f.y) < 4) last.push(f);
      else rowGroups.push([f]);
    }

    for (const group of rowGroups) {
      group.sort((a, b) => a.x - b.x);
      // merge fragments into cells: a big horizontal gap starts a new
      // column, a small one is just letter-spacing within the same word
      const cells: string[] = [];
      let cur = group[0].str;
      let curEnd = group[0].x + group[0].str.length * 5; // rough width estimate
      for (let i = 1; i < group.length; i++) {
        const f = group[i];
        if (f.x - curEnd > 10) {
          cells.push(cur.trim());
          cur = f.str;
        } else {
          cur += f.str;
        }
        curEnd = f.x + f.str.length * 5;
      }
      cells.push(cur.trim());
      rows.push(cells);
    }
  }
  return rows;
}

async function pdfToWorkbook(file: File): Promise<XLSX.WorkBook> {
  const rows = await pdfToRows(file);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return wb;
}

/**
 * Reads any supported input into a SheetJS workbook. cellDates:true keeps
 * dates as real dates instead of Excel's serial-number encoding, so
 * CSV/JSON output shows an actual date, not a number like 45123.
 */
async function fileToWorkbook(file: File): Promise<XLSX.WorkBook> {
  const ext = extOf(file.name);

  if (ext === "pdf") return pdfToWorkbook(file);

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

async function workbookToPdfBlob(wb: XLSX.WorkBook): Promise<Blob> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const head = rows.length ? [rows[0].map((c) => String(c))] : [];
  const body = rows.slice(1).map((r) => r.map((c) => (c == null ? "" : String(c))));

  const doc = new jsPDF({ orientation: body.length && head[0]?.length > 6 ? "landscape" : "portrait" });
  autoTable(doc, {
    head,
    body,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [46, 91, 255] },
    margin: { top: 16 },
  });
  return doc.output("blob");
}

/**
 * Writes a workbook to the requested format. CSV/JSON/PDF can only hold one
 * sheet — if the source had more than one, only the first is exported and
 * the caller is told so (surfaced in the UI as a warning, not silently).
 */
async function workbookToBlob(wb: XLSX.WorkBook, fmt: ConvFmt): Promise<{ blob: Blob; multiSheetDropped: boolean }> {
  const multiSheetDropped = fmt !== "xlsx" && wb.SheetNames.length > 1;

  if (fmt === "xlsx") {
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return { blob: new Blob([out], { type: FMT_MIME.xlsx }), multiSheetDropped };
  }

  if (fmt === "pdf") {
    const blob = await workbookToPdfBlob(wb);
    return { blob, multiSheetDropped };
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

async function convertFile(file: File, fmt: ConvFmt): Promise<{ blob: Blob; multiSheetDropped: boolean; sheets: number; rows: number }> {
  const wb = await fileToWorkbook(file);
  const { blob, multiSheetDropped } = await workbookToBlob(wb, fmt);
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const range = firstSheet["!ref"] ? XLSX.utils.decode_range(firstSheet["!ref"]) : null;
  const rows = range ? range.e.r - range.s.r : 0;
  return { blob, multiSheetDropped, sheets: wb.SheetNames.length, rows };
}

const ACCEPT = ".xlsx,.xls,.csv,.json,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/json,application/pdf";

function isSupported(file: File): boolean {
  return ["xlsx", "xls", "csv", "json", "pdf"].includes(extOf(file.name));
}

export default function FileConverter() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [fmt, setFmt] = useState<ConvFmt>("xlsx");
  const [name, setName] = useState("");
  const [inputExt, setInputExt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [out, setOut] = useState<{ url: string; blob: Blob; sheets: number; rows: number } | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runConvert = useCallback(
    async (file: File, targetFmt: ConvFmt) => {
      setError("");
      setWarning("");
      setBusy(true);
      try {
        const { blob, multiSheetDropped, sheets, rows } = await convertFile(file, targetFmt);
        setOut((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url: URL.createObjectURL(blob), blob, sheets, rows };
        });
        if (multiSheetDropped) {
          setWarning(
            `This file has ${sheets} sheets — ${FMT_LABEL[targetFmt]} can only hold one, so only the first sheet was exported.`
          );
        } else if (extOf(file.name) === "pdf") {
          setWarning(
            "Table extracted from PDF text positions — works best for clean, grid-aligned tables. Scanned PDFs (images of text) and complex layouts may come out wrong. Check the result before relying on it."
          );
        }
      } catch (err) {
        setError(err instanceof Error ? `Could not convert this file: ${err.message}` : "Could not convert this file.");
        setOut(null);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!isSupported(file)) {
        setError("That file type isn't supported. Use .xlsx, .xls, .csv, .json or .pdf.");
        return;
      }
      setName(file.name);
      setInputExt(extOf(file.name));
      runConvert(file, fmt);
    },
    [fmt, runConvert]
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
    setInputExt("");
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

  // same-format conversions are a no-op the tool can't do anything useful
  // with (pdf->pdf, csv->csv, etc.) — the dropdown only offers formats
  // that differ from the currently loaded file's format, to avoid a
  // confusing "convert PDF to PDF" state.
  const targetOptions = (Object.keys(FMT_LABEL) as ConvFmt[]).filter((f) => f !== inputExt || !name);

  return (
    <div className="tool">
      <div className="mode-row">
        <button type="button" className={`mode-btn${mode === "single" ? " on" : ""}`} onClick={() => setMode("single")}>Single file</button>
        <button type="button" className={`mode-btn${mode === "bulk" ? " on" : ""}`} onClick={() => setMode("bulk")}>Bulk (multiple)</button>
      </div>

      <label className="ctrl" style={{ padding: "0 6px 12px" }}>
        <span>Convert to</span>
        <select
          className="mono"
          value={fmt}
          onChange={(e) => {
            const next = e.target.value as ConvFmt;
            setFmt(next);
            if (mode === "single" && name && inputRef.current?.files?.[0]) {
              runConvert(inputRef.current.files[0], next);
            }
          }}
        >
          {targetOptions.map((f) => (
            <option key={f} value={f}>{FMT_LABEL[f]}</option>
          ))}
        </select>
      </label>

      {mode === "bulk" ? (
        <BulkPanel
          process={bulkProcess}
          zipName={`converted-${fmt}.zip`}
          accept={ACCEPT}
          filter={isSupported}
          label="files"
          hint={`Every file converted to ${FMT_LABEL[fmt]} · .xlsx, .xls, .csv, .json and .pdf accepted`}
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
          <h2 className="display">Drop a file to convert it</h2>
          <p>.xlsx, .xls, .csv, .json or .pdf · it never leaves your browser</p>
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
