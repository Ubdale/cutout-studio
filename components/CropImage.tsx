"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decode, sourceSize, release, canvasToBlob, triggerDownload,
  baseName, outputFmt, FMT_EXT,
} from "@/lib/image";

type Box = { x: number; y: number; w: number; h: number };
type Aspect = { label: string; value: number | null };

const ASPECTS: Aspect[] = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:4", value: 3 / 4 },
];

export default function CropImage() {
  const [over, setOver] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  const bmp = useRef<ImageBitmap | HTMLImageElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const box = useRef<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const drag = useRef<{ mode: string; sx: number; sy: number; start: Box; scale: number } | null>(null);
  const rerender = () => tick((n) => n + 1);

  useEffect(() => () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    release(bmp.current);
  }, [srcUrl]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    release(bmp.current);
    const decoded = await decode(file);
    bmp.current = decoded;
    const s = sourceSize(decoded);
    setNat(s);
    // start with an 80% centered box
    const w = s.w * 0.8, h = s.h * 0.8;
    box.current = { x: (s.w - w) / 2, y: (s.h - h) / 2, w, h };
    setAspect(null);
    setName(file.name);
    setSrcUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  }, []);

  const metrics = () => {
    const el = stageRef.current;
    if (!el || !nat.w) return { scale: 1, ox: 0, oy: 0 };
    const rect = el.getBoundingClientRect();
    const scale = Math.min(rect.width / nat.w, rect.height / nat.h);
    return { scale, ox: (rect.width - nat.w * scale) / 2, oy: (rect.height - nat.h * scale) / 2 };
  };

  const applyAspect = (a: number | null) => {
    setAspect(a);
    if (!a) return;
    const b = box.current;
    let w = b.w, h = w / a;
    if (h > nat.h) { h = nat.h; w = h * a; }
    if (w > nat.w) { w = nat.w; h = w / a; }
    b.w = w; b.h = h;
    b.x = Math.min(Math.max(0, b.x), nat.w - w);
    b.y = Math.min(Math.max(0, b.y), nat.h - h);
    rerender();
  };

  const onDown = (mode: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: { ...box.current }, scale: metrics().scale };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / d.scale;
    const dy = (e.clientY - d.sy) / d.scale;
    const b = { ...d.start };
    if (d.mode === "move") {
      b.x = Math.min(Math.max(0, d.start.x + dx), nat.w - b.w);
      b.y = Math.min(Math.max(0, d.start.y + dy), nat.h - b.h);
    } else {
      let { x, y, w, h } = d.start;
      if (d.mode.includes("e")) w = d.start.w + dx;
      if (d.mode.includes("s")) h = d.start.h + dy;
      if (d.mode.includes("w")) { w = d.start.w - dx; x = d.start.x + dx; }
      if (d.mode.includes("n")) { h = d.start.h - dy; y = d.start.y + dy; }
      if (aspect) {
        if (d.mode.includes("e") || d.mode.includes("w")) h = w / aspect;
        else w = h * aspect;
      }
      w = Math.max(24, w); h = Math.max(24, h);
      x = Math.min(Math.max(0, x), nat.w - 24);
      y = Math.min(Math.max(0, y), nat.h - 24);
      w = Math.min(w, nat.w - x);
      h = Math.min(h, nat.h - y);
      b.x = x; b.y = y; b.w = w; b.h = h;
    }
    box.current = b;
    rerender();
  };
  const onUp = () => { drag.current = null; };

  const download = useCallback(async () => {
    if (!bmp.current) return;
    setBusy(true);
    const b = box.current;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(b.w);
    canvas.height = Math.round(b.h);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp.current, b.x, b.y, b.w, b.h, 0, 0, canvas.width, canvas.height);
    const fmt = name.match(/\.jpe?g$/i) ? "image/jpeg" : name.match(/\.webp$/i) ? "image/webp" : "image/png";
    const blob = await canvasToBlob(canvas, outputFmt(fmt), 0.97);
    if (blob) {
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${baseName(name)}-cropped.${FMT_EXT[outputFmt(fmt)]}`);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    setBusy(false);
  }, [name]);

  const reset = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    release(bmp.current); bmp.current = null;
    setSrcUrl(null); setName(""); setNat({ w: 0, h: 0 });
    if (inputRef.current) inputRef.current.value = "";
  };

  const { scale, ox, oy } = metrics();
  const b = box.current;

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
          <h2 className="display">Drop an image to crop</h2>
          <p>Drag the box, snap to a ratio · crops in your browser</p>
          <button className="pick" type="button">Choose image</button>
          <input ref={inputRef} className="hidden-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="stage">
          <div className="meta mono">
            <span>{name}</span><span className="dot" />
            <span>crop {Math.round(b.w)}×{Math.round(b.h)}</span>
          </div>

          <div className="fmt-row">
            {ASPECTS.map((a) => (
              <button key={a.label} type="button" className={`fmt-btn${aspect === a.value ? " on" : ""}`} onClick={() => applyAspect(a.value)}>{a.label}</button>
            ))}
          </div>

          <div ref={stageRef} className="crop-stage checker" onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={srcUrl} alt="Crop source" className="crop-img" draggable={false} />
            <div
              className="crop-box"
              style={{ left: ox + b.x * scale, top: oy + b.y * scale, width: b.w * scale, height: b.h * scale }}
              onPointerDown={onDown("move")}
            >
              {["nw", "ne", "sw", "se"].map((h) => (
                <span key={h} className={`crop-handle ${h}`} onPointerDown={onDown(h)} />
              ))}
            </div>
          </div>

          <div className="actions">
            <button className="btn primary" type="button" onClick={download} disabled={busy}>{busy ? "Working…" : "Crop & download"}</button>
            <button className="btn" type="button" onClick={reset}>New image</button>
          </div>
        </div>
      )}
    </div>
  );
}
