"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decode, sourceSize, release, canvasToBlob, triggerDownload,
  baseName, prettyBytes, FMT_EXT,
} from "@/lib/image";

export default function ImageResizer() {
  const [over, setOver] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);
  const [lock, setLock] = useState(true);
  const [out, setOut] = useState<{ url: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const bmp = useRef<ImageBitmap | HTMLImageElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ratio = nat.w && nat.h ? nat.w / nat.h : 1;

  useEffect(() => () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (out) URL.revokeObjectURL(out.url);
    release(bmp.current);
  }, [srcUrl, out]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    release(bmp.current);
    const decoded = await decode(file);
    bmp.current = decoded;
    const s = sourceSize(decoded);
    setNat(s); setW(s.w); setH(s.h);
    setName(file.name);
    setSrcUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setOut(null);
  }, []);

  const changeW = (v: number) => {
    const nw = Math.max(1, Math.round(v || 0));
    setW(nw); if (lock) setH(Math.max(1, Math.round(nw / ratio)));
  };
  const changeH = (v: number) => {
    const nh = Math.max(1, Math.round(v || 0));
    setH(nh); if (lock) setW(Math.max(1, Math.round(nh * ratio)));
  };
  const scale = (pct: number) => {
    setW(Math.max(1, Math.round((nat.w * pct) / 100)));
    setH(Math.max(1, Math.round((nat.h * pct) / 100)));
  };

  const run = useCallback(async () => {
    if (!bmp.current) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp.current, 0, 0, w, h);
    const fmt = name.match(/\.jpe?g$/i) ? "image/jpeg" : name.match(/\.webp$/i) ? "image/webp" : "image/png";
    const blob = await canvasToBlob(canvas, fmt, 0.92);
    if (blob) setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size }; });
    setBusy(false);
  }, [w, h, name]);

  const download = () => {
    if (!out) return;
    const ext = name.match(/\.jpe?g$/i) ? FMT_EXT["image/jpeg"] : name.match(/\.webp$/i) ? FMT_EXT["image/webp"] : FMT_EXT["image/png"];
    triggerDownload(out.url, `${baseName(name)}-${w}x${h}.${ext}`);
  };

  const reset = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (out) URL.revokeObjectURL(out.url);
    release(bmp.current); bmp.current = null;
    setSrcUrl(null); setOut(null); setName(""); setNat({ w: 0, h: 0 });
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
          <h2 className="display">Drop an image to resize</h2>
          <p>Set exact pixels or scale by percent · resizes in your browser</p>
          <button className="pick" type="button">Choose image</button>
          <input ref={inputRef} className="hidden-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="stage">
          <div className="meta mono">
            <span>{name}</span><span className="dot" />
            <span>{nat.w}×{nat.h}</span>
            {out && (<><span className="dot" /><span>→ {w}×{h} · {prettyBytes(out.size)}</span></>)}
          </div>

          <div className="controls">
            <label className="ctrl">Width (px)
              <input className="num-input mono" type="number" inputMode="numeric" min={1} value={w} onChange={(e) => changeW(+e.target.value)} />
            </label>
            <label className="ctrl">Height (px)
              <input className="num-input mono" type="number" inputMode="numeric" min={1} value={h} onChange={(e) => changeH(+e.target.value)} />
            </label>
          </div>

          <div className="fmt-row">
            <button type="button" className={`fmt-btn${lock ? " on" : ""}`} onClick={() => setLock((v) => !v)}>
              {lock ? "🔒 Ratio locked" : "🔓 Ratio free"}
            </button>
            {[25, 50, 75, 100].map((p) => (
              <button key={p} type="button" className="fmt-btn" onClick={() => scale(p)}>{p}%</button>
            ))}
          </div>

          <div className="preview checker">
            <img src={out?.url ?? srcUrl} alt="Preview" />
          </div>

          <div className="actions">
            {!out ? (
              <button className="btn primary" type="button" onClick={run} disabled={busy}>{busy ? "Working…" : "Resize image"}</button>
            ) : (
              <>
                <button className="btn primary" type="button" onClick={download}>Download</button>
                <button className="btn" type="button" onClick={run} disabled={busy}>{busy ? "Working…" : "Re-run"}</button>
              </>
            )}
            <button className="btn" type="button" onClick={reset}>New image</button>
          </div>
        </div>
      )}
    </div>
  );
}
