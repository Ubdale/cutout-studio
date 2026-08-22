"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decode, sourceSize, release, canvasToBlob, triggerDownload,
  baseName, outputFmt, FMT_EXT,
} from "@/lib/image";

export default function ImageRotator() {
  const [over, setOver] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [deg, setDeg] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The File is the source of truth — each download decodes its own
  // throwaway bitmap rather than reusing one held in a ref, which proved
  // fragile across repeated downloads ("image source is detached").
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runGen = useRef(0);

  useEffect(() => () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
  }, [srcUrl]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    fileRef.current = file;
    const probe = await decode(file);
    setNat(sourceSize(probe));
    release(probe);
    setName(file.name);
    setDeg(0); setFlipH(false); setFlipV(false);
    setError("");
    setSrcUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  }, []);

  const download = useCallback(async () => {
    if (!fileRef.current) return;
    const myRun = ++runGen.current;
    const file = fileRef.current;
    setBusy(true);
    setError("");
    // try/finally guarantees the button never gets stuck on "Working…" —
    // without this, any failure here (huge canvas allocation, an
    // out-of-memory toBlob) left busy stuck true forever with no download
    // and no error, which looked like a permanent hang.
    let bmp: ImageBitmap | HTMLImageElement | null = null;
    try {
      bmp = await decode(file);
      if (myRun !== runGen.current) return;
      const rad = (deg * Math.PI) / 180;
      const swap = deg % 180 !== 0;
      const canvas = document.createElement("canvas");
      canvas.width = swap ? nat.h : nat.w;
      canvas.height = swap ? nat.w : nat.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create a canvas context");
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(bmp, -nat.w / 2, -nat.h / 2);
      ctx.restore();
      const fmt = name.match(/\.jpe?g$/i) ? "image/jpeg" : name.match(/\.webp$/i) ? "image/webp" : "image/png";
      const blob = await canvasToBlob(canvas, outputFmt(fmt), 0.97);
      if (myRun !== runGen.current) return;
      if (!blob) throw new Error("This image is too large for your browser to export. Try a smaller image.");
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${baseName(name)}-rotated.${FMT_EXT[outputFmt(fmt)]}`);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      if (myRun !== runGen.current) return;
      setError(err instanceof Error ? err.message : "Could not export this image.");
    } finally {
      release(bmp);
      if (myRun === runGen.current) setBusy(false);
    }
  }, [deg, flipH, flipV, nat, name]);

  const reset = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    fileRef.current = null;
    setSrcUrl(null); setName(""); setNat({ w: 0, h: 0 }); setError("");
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
          <h2 className="display">Drop an image to rotate</h2>
          <p>Turn 90° at a time or mirror it · runs in your browser</p>
          <button className="pick" type="button">Choose image</button>
          <input ref={inputRef} className="hidden-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="stage">
          <div className="meta mono">
            <span>{name}</span><span className="dot" /><span>{nat.w}×{nat.h}</span>
          </div>

          <div className="fmt-row">
            <button type="button" className="fmt-btn" onClick={() => setDeg((d) => (d + 270) % 360)}>↺ Left</button>
            <button type="button" className="fmt-btn" onClick={() => setDeg((d) => (d + 90) % 360)}>↻ Right</button>
            <button type="button" className={`fmt-btn${flipH ? " on" : ""}`} onClick={() => setFlipH((v) => !v)}>⇋ Flip H</button>
            <button type="button" className={`fmt-btn${flipV ? " on" : ""}`} onClick={() => setFlipV((v) => !v)}>⇅ Flip V</button>
          </div>

          <div className="preview checker">
            <img
              src={srcUrl}
              alt="Preview"
              style={{ transform: `rotate(${deg}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`, transition: "transform 0.2s ease" }}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="actions">
            <button className="btn primary" type="button" onClick={download} disabled={busy}>{busy ? "Working…" : "Download"}</button>
            <button className="btn" type="button" onClick={reset}>New image</button>
          </div>
        </div>
      )}
    </div>
  );
}
