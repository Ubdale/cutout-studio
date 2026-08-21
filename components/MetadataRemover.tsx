"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decode, sourceSize, release, canvasToBlob, triggerDownload,
  baseName, prettyBytes, type Fmt, FMT_LABEL, FMT_EXT, outputFmt,
} from "@/lib/image";

export default function MetadataRemover() {
  const [over, setOver] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [srcSize, setSrcSize] = useState(0);
  const [fmt, setFmt] = useState<Fmt>("image/jpeg");
  const [out, setOut] = useState<{ url: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const bmp = useRef<ImageBitmap | HTMLImageElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runGen = useRef(0);

  // Bitmap release must only fire when the source image changes (new
  // file / unmount) — tying it to `out` closed the bitmap on every
  // re-run, breaking the next draw with "image source is detached".
  useEffect(() => () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    release(bmp.current);
  }, [srcUrl]);

  useEffect(() => () => {
    if (out) URL.revokeObjectURL(out.url);
  }, [out]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    release(bmp.current);
    const decoded = await decode(file);
    bmp.current = decoded;
    setNat(sourceSize(decoded));
    setSrcSize(file.size);
    setName(file.name);
    setFmt(outputFmt(file.type));
    setError("");
    setSrcUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setOut(null);
  }, []);

  const run = useCallback(async () => {
    if (!bmp.current) return;
    const myRun = ++runGen.current;
    setBusy(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = nat.w; canvas.height = nat.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create a canvas context");
      if (fmt === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, nat.w, nat.h); }
      if (myRun !== runGen.current || !bmp.current) return;
      ctx.drawImage(bmp.current, 0, 0);
      const blob = await canvasToBlob(canvas, fmt, 0.97);
      if (myRun !== runGen.current) return;
      if (!blob) throw new Error("This image is too large for your browser to export. Try a smaller image.");
      setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size }; });
    } catch (err) {
      if (myRun !== runGen.current) return;
      setError(err instanceof Error ? err.message : "Could not process this image.");
    } finally {
      if (myRun === runGen.current) setBusy(false);
    }
  }, [nat, fmt]);

  const download = () => {
    if (!out) return;
    triggerDownload(out.url, `${baseName(name)}-clean.${FMT_EXT[fmt]}`);
  };

  const reset = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (out) URL.revokeObjectURL(out.url);
    release(bmp.current); bmp.current = null;
    setSrcUrl(null); setOut(null); setName(""); setNat({ w: 0, h: 0 }); setSrcSize(0); setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="tool">
      {!srcUrl ? (
        <div
          className={`drop${over ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        >
          <div className="drop-mark checker" />
          <h2 className="display">Drop an image to clean</h2>
          <p>Strips EXIF, GPS and camera data · nothing leaves your device</p>
          <button className="pick" type="button">Choose image</button>
          <input ref={inputRef} className="hidden-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="stage">
          <div className="meta mono">
            <span>{name}</span><span className="dot" /><span>{prettyBytes(srcSize)}</span>
            {out && (<><span className="dot" /><span>→ {prettyBytes(out.size)}, metadata removed</span></>)}
          </div>

          <p className="hint">Re-encoding keeps only the pixels, so every hidden field — location, camera model, timestamps — is dropped. Choose an output format:</p>

          <div className="fmt-row">
            {(Object.keys(FMT_LABEL) as Fmt[]).map((f) => (
              <button key={f} type="button" className={`fmt-btn${fmt === f ? " on" : ""}`} onClick={() => { setFmt(f); setOut(null); }}>{FMT_LABEL[f]}</button>
            ))}
          </div>

          <div className="preview checker">
            <img src={out?.url ?? srcUrl} alt="Preview" />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="actions">
            {!out ? (
              <button className="btn primary" type="button" onClick={run} disabled={busy}>{busy ? "Working…" : "Remove metadata"}</button>
            ) : (
              <button className="btn primary" type="button" onClick={download}>Download clean {FMT_LABEL[fmt]}</button>
            )}
            <button className="btn" type="button" onClick={reset}>New image</button>
          </div>
        </div>
      )}
    </div>
  );
}
