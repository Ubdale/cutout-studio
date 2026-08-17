"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prettyBytes, outputFmt, FMT_LABEL, FMT_EXT, type Fmt } from "@/lib/image";
import BulkPanel, { type BulkResult } from "./BulkPanel";

type Result = { url: string; blob: Blob; w: number; h: number };

// Shared by both the single-file preview path and bulk mode so the two
// never drift out of sync.
function compressFile(file: File, q: number, mw: number, f: Fmt): Promise<Result> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = mw && image.naturalWidth > mw ? mw / image.naturalWidth : 1;
        const w = Math.round(image.naturalWidth * scale);
        const h = Math.round(image.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create a canvas context");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        if (f === "image/jpeg") {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(image, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) resolve({ url: URL.createObjectURL(blob), blob, w, h });
          else reject(new Error("Too large for your browser to export"));
        }, f, q);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err instanceof Error ? err : new Error("Could not compress this file"));
      }
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode")); };
    image.src = url;
  });
}

export default function ImageCompressor() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [over, setOver] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("");
  const [origSize, setOrigSize] = useState(0);
  const [quality, setQuality] = useState(0.7);
  const [maxW, setMaxW] = useState(0); // 0 = keep original width
  const [fmt, setFmt] = useState<Fmt>("image/jpeg");
  const [out, setOut] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (srcUrl) URL.revokeObjectURL(srcUrl);
      if (out) URL.revokeObjectURL(out.url);
    };
  }, [srcUrl, out]);

  const compress = useCallback(
    (image: HTMLImageElement, q: number, mw: number, f: Fmt) => {
      setBusy(true);
      setError("");
      try {
        const scale = mw && image.naturalWidth > mw ? mw / image.naturalWidth : 1;
        const w = Math.round(image.naturalWidth * scale);
        const h = Math.round(image.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create a canvas context");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        // PNG has no alpha loss to worry about, but JPG needs an opaque
        // background or transparent pixels turn black.
        if (f === "image/jpeg") {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(image, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              setOut((prev) => {
                if (prev) URL.revokeObjectURL(prev.url);
                return { url: URL.createObjectURL(blob), blob, w, h };
              });
            } else {
              setError("This image is too large for your browser to export. Try a smaller image or lower the max width.");
            }
            setBusy(false);
          },
          f,
          q
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not compress this image.");
        setBusy(false);
      }
    },
    []
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      setSrcUrl(url);
      setName(file.name);
      setOrigSize(file.size);
      setError("");
      const detected = outputFmt(file.type);
      setFmt(detected);
      const image = new Image();
      image.onload = () => {
        setImg(image);
        compress(image, quality, maxW, detected);
      };
      image.onerror = () => setError("Could not read this image.");
      image.src = url;
    },
    [compress, quality, maxW]
  );

  // re-compress when settings change
  useEffect(() => {
    if (img) compress(img, quality, maxW, fmt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, maxW, fmt]);

  const reset = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (out) URL.revokeObjectURL(out.url);
    setSrcUrl(null);
    setImg(null);
    setOut(null);
    setName("");
    setOrigSize(0);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const download = () => {
    if (!out) return;
    const a = document.createElement("a");
    a.href = out.url;
    a.download = name.replace(/\.[^.]+$/, "") + "-compressed." + FMT_EXT[fmt];
    a.click();
  };

  const saved = out && origSize ? Math.max(0, Math.round((1 - out.blob.size / origSize) * 100)) : 0;

  const bulkProcess = useCallback(
    async (file: File): Promise<BulkResult> => {
      const r = await compressFile(file, quality, maxW, fmt);
      URL.revokeObjectURL(r.url); // bulk mode only needs the blob, not a preview URL
      return { blob: r.blob, ext: FMT_EXT[fmt] };
    },
    [quality, maxW, fmt]
  );

  return (
    <div className="tool">
      <div className="mode-row">
        <button type="button" className={`mode-btn${mode === "single" ? " on" : ""}`} onClick={() => setMode("single")}>Single image</button>
        <button type="button" className={`mode-btn${mode === "bulk" ? " on" : ""}`} onClick={() => setMode("bulk")}>Bulk (multiple)</button>
      </div>

      {mode === "bulk" ? (
        <>
          <div className="controls">
            {fmt !== "image/png" && (
              <label className="ctrl">
                <span>Quality: {Math.round(quality * 100)}%</span>
                <input type="range" min={10} max={100} value={quality * 100} onChange={(e) => setQuality(Number(e.target.value) / 100)} />
              </label>
            )}
            <label className="ctrl">
              <span>Max width: {maxW ? `${maxW}px` : "original"}</span>
              <input type="range" min={0} max={4000} step={100} value={maxW} onChange={(e) => setMaxW(Number(e.target.value))} />
            </label>
          </div>
          <div className="fmt-row">
            {(Object.keys(FMT_LABEL) as Fmt[]).map((f) => (
              <button key={f} type="button" className={`fmt-btn${fmt === f ? " on" : ""}`} onClick={() => setFmt(f)}>
                {FMT_LABEL[f]}
              </button>
            ))}
          </div>
          <BulkPanel
            process={bulkProcess}
            zipName="compressed-images.zip"
            suffix="-compressed"
            hint="Same quality, width and format settings applied to every file, in parallel"
          />
        </>
      ) : !img ? (
        <div
          className={`drop${over ? " over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        >
          <div className="drop-mark checker" />
          <h2 className="display">Drop an image to compress</h2>
          <p>JPG, PNG or WebP · shrinks in your browser, nothing uploaded</p>
          <button className="pick" type="button">Choose image</button>
          <input ref={inputRef} className="hidden-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="stage">
          <div className="meta mono">
            <span>{name}</span>
            <span className="dot" />
            <span>{prettyBytes(origSize)}</span>
            {out && (
              <>
                <span className="dot" />
                <span>→ {prettyBytes(out.blob.size)}</span>
                <span className="dot" />
                <span style={{ color: saved > 0 ? "var(--accent)" : "inherit" }}>{saved}% smaller</span>
              </>
            )}
          </div>

          <div className="controls">
            {fmt !== "image/png" && (
              <label className="ctrl">
                <span>Quality: {Math.round(quality * 100)}%</span>
                <input type="range" min={10} max={100} value={quality * 100} onChange={(e) => setQuality(Number(e.target.value) / 100)} />
              </label>
            )}
            <label className="ctrl">
              <span>Max width: {maxW ? `${maxW}px` : "original"}</span>
              <input type="range" min={0} max={4000} step={100} value={maxW} onChange={(e) => setMaxW(Number(e.target.value))} />
            </label>
          </div>

          <div className="fmt-row">
            {(Object.keys(FMT_LABEL) as Fmt[]).map((f) => (
              <button key={f} type="button" className={`fmt-btn${fmt === f ? " on" : ""}`} onClick={() => setFmt(f)}>
                {FMT_LABEL[f]}
              </button>
            ))}
          </div>

          {out && (
            <div className="preview checker">
              <img src={out.url} alt="Compressed preview" />
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="actions">
            <button className="btn primary" type="button" onClick={download} disabled={busy || !out}>
              {busy ? "Working…" : `Download ${FMT_LABEL[fmt]}`}
            </button>
            <button className="btn" type="button" onClick={reset}>New image</button>
          </div>
        </div>
      )}
    </div>
  );
}
