"use client";

import { useRef, useState } from "react";
import { prettyBytes } from "@/lib/image";
import { runQueue, downloadZip, idealConcurrency, type QueueItem, type CancelToken } from "@/lib/bulk";

export interface BulkResult {
  blob: Blob;
  ext: string;
}

export default function BulkPanel({
  process,
  heavy = false,
  zipName = "images.zip",
  hint,
  suffix = "",
  accept = "image/*",
  filter,
  label = "images",
}: {
  /** Converts one input file to one output blob, using the tool's current settings. */
  process: (file: File) => Promise<BulkResult>;
  /** True for WASM/ML-heavy work (background removal) — runs fewer in parallel. */
  heavy?: boolean;
  zipName?: string;
  hint?: string;
  /** appended before the extension, e.g. "-compressed" */
  suffix?: string;
  /** file input's accept attribute — narrows the OS file picker */
  accept?: string;
  /** which dropped/selected files to actually process; defaults to images only */
  filter?: (file: File) => boolean;
  /** noun used in the default drop-zone copy, e.g. "spreadsheets" */
  label?: string;
}) {
  const matches = filter ?? ((f: File) => f.type.startsWith("image/"));
  const [items, setItems] = useState<QueueItem<BulkResult>[]>([]);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const cancelRef = useRef<CancelToken>({ cancelled: false });
  const inputRef = useRef<HTMLInputElement>(null);

  const outName = (file: File, ext: string) =>
    file.name.replace(/\.[^.]+$/, "") + suffix + "." + ext;

  const start = async (files: File[]) => {
    const matched = files.filter(matches);
    if (!matched.length) return;
    cancelRef.current = { cancelled: false };
    setRunning(true);
    await runQueue(matched, process, {
      concurrency: idealConcurrency(heavy),
      onUpdate: setItems,
      signal: cancelRef.current,
    });
    setRunning(false);
  };

  const done = items.filter((i) => i.status === "done" && i.result);
  const totalIn = items.reduce((s, i) => s + i.file.size, 0);
  const totalOut = done.reduce((s, i) => s + (i.result?.blob.size ?? 0), 0);

  const downloadAll = async () => {
    if (!done.length) return;
    await downloadZip(
      done.map((i) => ({ name: outName(i.file, i.result!.ext), blob: i.result!.blob })),
      zipName
    );
  };

  const downloadOne = (it: QueueItem<BulkResult>) => {
    if (!it.result) return;
    const url = URL.createObjectURL(it.result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outName(it.file, it.result.ext);
    a.click();
    URL.revokeObjectURL(url);
  };

  const cancel = () => {
    cancelRef.current.cancelled = true;
    setRunning(false);
  };

  const clear = () => {
    setItems([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      {items.length === 0 ? (
        <div
          className={`drop${over ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); start(Array.from(e.dataTransfer.files)); }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        >
          <div className="drop-mark checker" />
          <h2 className="display">Drop multiple {label} to batch process</h2>
          <p>{hint || "Same settings applied to every file, in parallel · no upload, no file limit"}</p>
          <button className="pick" type="button">Choose {label}</button>
          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            accept={accept}
            multiple
            onChange={(e) => start(Array.from(e.target.files ?? []))}
          />
        </div>
      ) : (
        <div className="stage">
          <div className="meta mono">
            <span>{items.length} files</span>
            <span className="dot" />
            <span>{done.length} done{running ? "…" : ""}</span>
            {totalOut > 0 && (
              <>
                <span className="dot" />
                <span>{prettyBytes(totalIn)} → {prettyBytes(totalOut)}</span>
              </>
            )}
          </div>

          <div className="bulk-list">
            {items.map((it) => (
              <div key={it.id} className={`bulk-row ${it.status}`}>
                <span className="bulk-name mono">{it.file.name}</span>
                <span className="bulk-status mono">
                  {it.status === "queued" && "Queued"}
                  {it.status === "working" && "Working…"}
                  {it.status === "done" && it.result && prettyBytes(it.result.blob.size)}
                  {it.status === "error" && (it.error || "Failed")}
                </span>
                {it.status === "done" && (
                  <button className="btn small" type="button" onClick={() => downloadOne(it)}>
                    Download
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="actions">
            <button className="btn primary" type="button" onClick={downloadAll} disabled={!done.length}>
              Download all as ZIP ({done.length})
            </button>
            {running ? (
              <button className="btn" type="button" onClick={cancel}>Cancel</button>
            ) : (
              <button className="btn" type="button" onClick={clear}>Clear</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
