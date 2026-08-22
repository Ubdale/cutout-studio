"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decode, sourceSize, release, canvasToBlob, triggerDownload, baseName,
} from "@/lib/image";

// Renders the exact same circular crop used for both the live preview and
// the final download — previously the preview faked circularity with a
// CSS border-radius on the plain rectangular image, which only visually
// clipped whatever crop the browser's object-fit happened to pick. That
// didn't necessarily match the canvas math below (centered square crop,
// then an arc clip), so what you saw before clicking "download" could
// differ from what you actually got. Now the preview *is* this function's
// output, so there's nothing to get out of sync.
async function circleCropFile(file: File, ring: number): Promise<{ blob: Blob; size: number }> {
  const bmp = await decode(file);
  try {
    const { w, h } = sourceSize(bmp);
    const size = Math.min(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create a canvas context");
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - ring, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(bmp, (w - size) / 2, (h - size) / 2, size, size, 0, 0, size, size);
    ctx.restore();
    if (ring > 0) {
      ctx.lineWidth = ring;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - ring / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    const blob = await canvasToBlob(canvas, "image/png"); // PNG keeps the transparent corners
    if (!blob) throw new Error("This image is too large for your browser to export. Try a smaller image.");
    return { blob, size };
  } finally {
    release(bmp);
  }
}

export default function CircleCrop() {
  const [over, setOver] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [ring, setRing] = useState(0);
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The File is the source of truth — each run decodes its own throwaway
  // bitmap rather than reusing one held in a ref (see fresh-decode notes
  // elsewhere in this codebase for why that mattered).
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runGen = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
  }, [srcUrl]);
  useEffect(() => () => {
    if (out) URL.revokeObjectURL(out);
  }, [out]);

  const run = useCallback(async () => {
    if (!fileRef.current) return;
    const myRun = ++runGen.current;
    const file = fileRef.current;
    setBusy(true);
    setError("");
    try {
      const { blob } = await circleCropFile(file, ring);
      if (myRun !== runGen.current) return; // superseded by a newer run — discard
      setOut((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    } catch (err) {
      if (myRun !== runGen.current) return;
      setError(err instanceof Error ? err.message : "Could not create the circle crop.");
    } finally {
      if (myRun === runGen.current) setBusy(false);
    }
  }, [ring]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    fileRef.current = file;
    const probe = await decode(file);
    setNat(sourceSize(probe));
    release(probe);
    setName(file.name);
    setError("");
    setSrcUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setOut(null);
  }, []);

  // Live preview: re-crop whenever a new image loads or the ring width
  // changes. Debounced so dragging the slider re-encodes once after you
  // pause, not on every intermediate value.
  useEffect(() => {
    if (!fileRef.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => run(), 120);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcUrl, ring]);

  const download = () => { if (out) triggerDownload(out, `${baseName(name)}-circle.png`); };

  const reset = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (out) URL.revokeObjectURL(out);
    fileRef.current = null;
    setSrcUrl(null); setOut(null); setName(""); setNat({ w: 0, h: 0 }); setRing(0); setError("");
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
          <h2 className="display">Drop a photo for a circle crop</h2>
          <p>Round profile picture on a transparent PNG · in your browser</p>
          <button className="pick" type="button">Choose image</button>
          <input ref={inputRef} className="hidden-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="stage">
          <div className="meta mono">
            <span>{name}</span><span className="dot" /><span>{nat.w}×{nat.h}</span>
            <span className="dot" /><span>→ {Math.min(nat.w, nat.h)}×{Math.min(nat.w, nat.h)} PNG</span>
          </div>

          <div className="controls">
            <label className="ctrl">White ring — {ring}px
              <input type="range" min={0} max={48} value={ring} onChange={(e) => setRing(+e.target.value)} />
            </label>
          </div>

          <div className="preview checker">
            {out ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={out} alt="Circular crop preview" style={{ maxWidth: "min(320px, 80%)", maxHeight: 320 }} />
            ) : (
              <span className="status"><span className="spinner" />Rendering preview…</span>
            )}
          </div>

          {error && <div className="error">{error}</div>}

          <div className="actions">
            <button className="btn primary" type="button" onClick={download} disabled={busy || !out}>
              {busy ? "Working…" : "Download PNG"}
            </button>
            <button className="btn" type="button" onClick={reset}>New image</button>
          </div>
        </div>
      )}
    </div>
  );
}
