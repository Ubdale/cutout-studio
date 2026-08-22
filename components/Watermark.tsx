"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decode, sourceSize, release, canvasToBlob, triggerDownload,
  baseName, prettyBytes, outputFmt, FMT_LABEL, FMT_EXT, type Fmt,
} from "@/lib/image";
import BulkPanel, { type BulkResult } from "./BulkPanel";

type Position = "tl" | "tc" | "tr" | "cl" | "cc" | "cr" | "bl" | "bc" | "br";

const POSITIONS: { value: Position; label: string }[] = [
  { value: "tl", label: "↖" }, { value: "tc", label: "↑" }, { value: "tr", label: "↗" },
  { value: "cl", label: "←" }, { value: "cc", label: "•" }, { value: "cr", label: "→" },
  { value: "bl", label: "↙" }, { value: "bc", label: "↓" }, { value: "br", label: "↘" },
];

export interface WatermarkSettings {
  text: string;
  size: number; // px, relative to a 1000px-wide image; scaled per-image
  opacity: number; // 0-1
  color: string;
  position: Position;
  tiled: boolean;
  rotateTiled: number; // degrees, only used when tiled
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, s: WatermarkSettings) {
  if (!s.text.trim()) return;
  const fontSize = Math.max(8, Math.round((s.size / 1000) * w));
  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.fillStyle = s.color;
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  ctx.textBaseline = "middle";

  if (s.tiled) {
    const metrics = ctx.measureText(s.text);
    const stepX = metrics.width + fontSize * 2;
    const stepY = fontSize * 4;
    ctx.translate(w / 2, h / 2);
    ctx.rotate((s.rotateTiled * Math.PI) / 180);
    ctx.textAlign = "center";
    const span = Math.hypot(w, h);
    for (let y = -span; y <= span; y += stepY) {
      for (let x = -span; x <= span; x += stepX) {
        ctx.fillText(s.text, x, y);
      }
    }
  } else {
    const pad = fontSize * 0.6;
    const align: CanvasTextAlign = s.position.endsWith("l") ? "left" : s.position.endsWith("r") ? "right" : "center";
    ctx.textAlign = align;
    const x = s.position.endsWith("l") ? pad : s.position.endsWith("r") ? w - pad : w / 2;
    const y = s.position.startsWith("t") ? pad + fontSize / 2 : s.position.startsWith("b") ? h - pad - fontSize / 2 : h / 2;
    ctx.fillText(s.text, x, y);
  }
  ctx.restore();
}

// Decodes a throwaway bitmap, draws + watermarks it, and closes it again —
// every call owns its own bitmap for its own brief lifetime. This is the
// same pattern bulk mode already used (a fresh decode per file inside each
// worker task), which is why bulk mode never hit the "detached" bug that
// the single-image path did: a bitmap kept alive across renders/settings
// changes in a ref could be closed or otherwise invalidated by something
// else touching the same ref before this call got to use it. Decoding
// fresh every time removes that whole class of bug — nothing else can
// ever hold or close *this* bitmap.
async function watermarkFile(file: File, s: WatermarkSettings, fmt: Fmt): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await decode(file);
  try {
    const { w, h } = sourceSize(bmp);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create a canvas context");
    if (fmt === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bmp, 0, 0);
    drawWatermark(ctx, w, h, s);
    const blob = await canvasToBlob(canvas, fmt, 0.97);
    if (!blob) throw new Error("This image is too large for your browser to export. Try a smaller image.");
    return { blob, w, h };
  } finally {
    release(bmp);
  }
}

const DEFAULTS: WatermarkSettings = {
  text: "© Your Name",
  size: 36,
  opacity: 0.6,
  color: "#ffffff",
  position: "br",
  tiled: false,
  rotateTiled: -30,
};

export default function Watermark() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [settings, setSettings] = useState<WatermarkSettings>(DEFAULTS);
  const [over, setOver] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [fmt, setFmt] = useState<Fmt>("image/jpeg");
  const [out, setOut] = useState<{ url: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The source of truth is the File itself, not a decoded bitmap — see
  // the comment on watermarkFile() for why.
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runGen = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
  }, [srcUrl]);
  useEffect(() => () => {
    if (out) URL.revokeObjectURL(out.url);
  }, [out]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    fileRef.current = file;
    // decode once just to read dimensions for the UI, then let it go —
    // this is not the bitmap that gets drawn later
    const probe = await decode(file);
    setNat(sourceSize(probe));
    release(probe);
    setName(file.name);
    setFmt(outputFmt(file.type));
    setError("");
    setSrcUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setOut(null);
  }, []);

  const run = useCallback(async () => {
    if (!fileRef.current) return;
    // Claim this as the latest run so a slower/failed older run (from
    // rapid slider dragging) can never overwrite what a newer one already
    // produced.
    const myRun = ++runGen.current;
    const file = fileRef.current;
    setBusy(true);
    setError("");
    try {
      const { blob } = await watermarkFile(file, settings, fmt);
      if (myRun !== runGen.current) return; // superseded — discard
      setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size }; });
    } catch (err) {
      if (myRun !== runGen.current) return;
      setError(err instanceof Error ? err.message : "Could not watermark this image.");
    } finally {
      if (myRun === runGen.current) setBusy(false);
    }
  }, [settings, fmt]);

  // live preview: re-stamp whenever a new image loads or a setting
  // changes. Debounced so dragging a slider re-encodes once after you
  // pause, not on every intermediate value.
  useEffect(() => {
    if (!fileRef.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => run(), 120);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcUrl, settings, fmt]);

  const download = () => {
    if (!out) return;
    triggerDownload(out.url, `${baseName(name)}-watermarked.${FMT_EXT[fmt]}`);
  };

  const reset = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (out) URL.revokeObjectURL(out.url);
    fileRef.current = null;
    setSrcUrl(null); setOut(null); setName(""); setNat({ w: 0, h: 0 }); setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const bulkProcess = useCallback(
    async (file: File): Promise<BulkResult> => {
      const detected = outputFmt(file.type);
      const { blob } = await watermarkFile(file, settings, detected);
      return { blob, ext: FMT_EXT[detected] };
    },
    [settings]
  );

  const set = <K extends keyof WatermarkSettings>(key: K, value: WatermarkSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const controls = (
    <>
      <div className="controls">
        <label className="ctrl">
          <span>Watermark text</span>
          <input
            className="mono"
            type="text"
            value={settings.text}
            onChange={(e) => set("text", e.target.value)}
            placeholder="© Your Name"
            maxLength={60}
          />
        </label>
        <label className="ctrl">
          <span>Size: {settings.size}</span>
          <input type="range" min={12} max={120} value={settings.size} onChange={(e) => set("size", Number(e.target.value))} />
        </label>
        <label className="ctrl">
          <span>Opacity: {Math.round(settings.opacity * 100)}%</span>
          <input type="range" min={10} max={100} value={settings.opacity * 100} onChange={(e) => set("opacity", Number(e.target.value) / 100)} />
        </label>
        <label className="ctrl">
          <span>Color</span>
          <input type="color" value={settings.color} onChange={(e) => set("color", e.target.value)} />
        </label>
      </div>

      <div className="fmt-row">
        <button type="button" className={`fmt-btn${!settings.tiled ? " on" : ""}`} onClick={() => set("tiled", false)}>Single mark</button>
        <button type="button" className={`fmt-btn${settings.tiled ? " on" : ""}`} onClick={() => set("tiled", true)}>Tiled (repeats)</button>
      </div>

      {!settings.tiled ? (
        <div className="fmt-row">
          {POSITIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`fmt-btn${settings.position === p.value ? " on" : ""}`}
              onClick={() => set("position", p.value)}
              title={p.value}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="controls">
          <label className="ctrl">
            <span>Tile angle: {settings.rotateTiled}°</span>
            <input type="range" min={-90} max={90} value={settings.rotateTiled} onChange={(e) => set("rotateTiled", Number(e.target.value))} />
          </label>
        </div>
      )}
    </>
  );

  return (
    <div className="tool">
      <div className="mode-row">
        <button type="button" className={`mode-btn${mode === "single" ? " on" : ""}`} onClick={() => setMode("single")}>Single image</button>
        <button type="button" className={`mode-btn${mode === "bulk" ? " on" : ""}`} onClick={() => setMode("bulk")}>Bulk (multiple)</button>
      </div>

      {mode === "bulk" ? (
        <>
          {controls}
          <BulkPanel
            process={bulkProcess}
            zipName="watermarked-images.zip"
            suffix="-watermarked"
            hint="Same watermark settings applied to every file, in parallel"
          />
        </>
      ) : !srcUrl ? (
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
          <h2 className="display">Drop an image to watermark</h2>
          <p>Text watermark, single or tiled · stamped in your browser</p>
          <button className="pick" type="button">Choose image</button>
          <input ref={inputRef} className="hidden-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="stage">
          <div className="meta mono">
            <span>{name}</span><span className="dot" /><span>{nat.w}×{nat.h}</span>
          </div>

          {controls}

          <div className="preview checker">
            <img src={out?.url ?? srcUrl} alt="Preview" />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="actions">
            <button className="btn primary" type="button" onClick={download} disabled={busy || !out}>
              {busy ? "Working…" : "Download"}
            </button>
            <button className="btn" type="button" onClick={reset}>New image</button>
          </div>
        </div>
      )}
    </div>
  );
}
