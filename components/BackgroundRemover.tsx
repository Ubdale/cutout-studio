"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FMT_LABEL, FMT_EXT, type Fmt } from "@/lib/image";
import BulkPanel, { type BulkResult } from "./BulkPanel";

type Phase = "idle" | "working" | "done" | "error";

// fp16: best quality, larger one-time model download (~85MB). quint8
// (int8-quantized): ~40MB and noticeably faster to run, at a small
// edge-detail quality cost. Rather than ask the user to pick, this picks
// automatically from the device's core count — low-core devices get the
// faster model (best quality would feel sluggish on CPU-only WASM there),
// higher-core devices get the more accurate one since the extra compute
// is barely noticeable. One model, chosen once, no user-facing toggle.
type ModelId = "isnet_fp16" | "isnet_quint8";

function pickModel(): ModelId {
  if (typeof navigator === "undefined") return "isnet_fp16";
  const cores = navigator.hardwareConcurrency || 4;
  return cores <= 4 ? "isnet_quint8" : "isnet_fp16";
}

// WebGPU is disabled here on purpose. It failed three different ways in a
// row on this library version — "worker not ready", a WASM init race, then
// "Failed to initialize JSEP" — and none of those were fixable from our
// side (they're inside the library/browser's WebGPU plumbing). CPU/WASM is
// slower but has been reliable, and a working tool beats a faster broken
// one. Revisit only after testing in a real browser, not just tsc.
async function removeBgFile(file: File, model: ModelId): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  return removeBackground(file, {
    model,
    device: "cpu",
    output: { format: "image/png" },
  });
}

function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackgroundRemover() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [model] = useState<ModelId>(pickModel);
  const [phase, setPhase] = useState<Phase>("idle");
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pos, setPos] = useState(50);

  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [fmt, setFmt] = useState<Fmt>("image/png");
  const [downloading, setDownloading] = useState(false);
  const [info, setInfo] = useState<{
    name: string;
    size: number;
    w: number;
    h: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const cutoutBlob = useRef<Blob | null>(null);

  // warm the model in the background so the first removal feels instant
  useEffect(() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const schedule = w.requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 1500));
    const id = schedule(async () => {
      try {
        const mod = (await import("@imgly/background-removal")) as {
          preload?: (config?: unknown) => Promise<void>;
        };
        await mod.preload?.({ model });
      } catch {
        /* preload is best-effort */
      }
    });
    return () => w.cancelIdleCallback?.(id as number);
  }, [model]);

  // clean up object URLs
  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    };
  }, [originalUrl, cutoutUrl]);

  const reset = useCallback(() => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    cutoutBlob.current = null;
    setOriginalUrl(null);
    setCutoutUrl(null);
    setInfo(null);
    setError("");
    setStatus("");
    setPos(50);
    setFmt("image/png");
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }, [originalUrl, cutoutUrl]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("That is not an image. Pick a JPG, PNG or WebP file.");
      setPhase("error");
      return;
    }

    setError("");
    setPhase("working");
    setStatus("Reading your image…");

    const srcUrl = URL.createObjectURL(file);
    setOriginalUrl(srcUrl);

    // read dimensions
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = srcUrl;
    });
    setInfo({ name: file.name, size: file.size, w: dims.w, h: dims.h });

    try {
      // load the library only when needed (keeps the page light)
      const { removeBackground } = await import("@imgly/background-removal");

      // WebGPU disabled — see the comment on removeBgFile above.
      const result = await removeBackground(file, {
        model,
        device: "cpu",
        output: { format: "image/png" },
        progress: (key: string, current: number, total: number) => {
          if (key.startsWith("fetch")) {
            const pct = total ? Math.round((current / total) * 100) : 0;
            setStatus(`Preparing the model, one time only… ${pct}%`);
          } else {
            setStatus("Removing the background…");
          }
        },
      });

      cutoutBlob.current = result;
      setCutoutUrl(URL.createObjectURL(result));
      setPhase("done");
      setStatus("");
    } catch (err) {
      console.error(err);
      setError(
        "Could not process this image. Try a different file, or reload the page and retry."
      );
      setPhase("error");
    }
  }, [model]);

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

  const download = useCallback(async () => {
    if (!cutoutBlob.current || !info) return;
    const base = info.name.replace(/\.[^.]+$/, "");

    // PNG keeps the alpha channel straight from the model's output — no
    // re-encode needed, so this path stays instant.
    if (fmt === "image/png") {
      const url = URL.createObjectURL(cutoutBlob.current);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}-cutout.png`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // JPG/WebP: composite onto a white canvas first since JPG has no
    // transparency (and a transparent WebP export would look identical
    // to the PNG, just heavier for photo-style output).
    setDownloading(true);
    try {
      const bmp = await createImageBitmap(cutoutBlob.current);
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0);
      bmp.close?.();
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${base}-cutout.${FMT_EXT[fmt]}`;
          a.click();
          URL.revokeObjectURL(url);
        }
        setDownloading(false);
      }, fmt, 0.97);
    } catch {
      setDownloading(false);
    }
  }, [fmt, info]);

  const aspect = info && info.w && info.h ? `${info.w} / ${info.h}` : "4 / 3";

  const bulkProcess = useCallback(async (file: File): Promise<BulkResult> => {
    const blob = await removeBgFile(file, model);
    return { blob, ext: "png" };
  }, [model]);

  return (
    <div className="tool">
      <div className="mode-row">
        <button type="button" className={`mode-btn${mode === "single" ? " on" : ""}`} onClick={() => setMode("single")}>Single image</button>
        <button type="button" className={`mode-btn${mode === "bulk" ? " on" : ""}`} onClick={() => setMode("bulk")}>Bulk (multiple)</button>
      </div>

      {mode === "bulk" ? (
        <BulkPanel
          process={bulkProcess}
          heavy
          zipName="cutouts.zip"
          suffix="-cutout"
          hint="Runs 1-2 at a time — background removal is the heaviest tool here, so this keeps it stable instead of racing every core at once"
        />
      ) : phase === "idle" && (
        <div
          className={`drop${over ? " over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <div className="drop-mark checker" />
          <h2 className="display">Drop an image to remove its background</h2>
          <p>PNG, JPG or WebP · it never leaves your browser</p>
          <button className="pick" type="button">
            Choose image
          </button>
          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            accept="image/*"
            onChange={onInput}
          />
        </div>
      )}

      {mode === "single" && phase !== "idle" && (
        <div className="stage">
          {info && (
            <div className="meta mono">
              <span>{info.name}</span>
              <span className="dot" />
              <span>{prettyBytes(info.size)}</span>
              {info.w > 0 && (
                <>
                  <span className="dot" />
                  <span>
                    {info.w}×{info.h}
                  </span>
                </>
              )}
            </div>
          )}

          {error && <div className="error">{error}</div>}

          {phase === "working" && (
            <div className="status">
              <span className="spinner" />
              <span>{status || "Working…"}</span>
            </div>
          )}

          {(phase === "working" || phase === "done") && originalUrl && (
            <div
              className="reveal checker"
              style={{ aspectRatio: aspect }}
            >
              {/* bottom: the cutout on the checkerboard */}
              {cutoutUrl && (
                <div className="layer">
                  <img src={cutoutUrl} alt="Background removed" />
                </div>
              )}
              {/* top: the original, clipped by the slider */}
              <div
                className="layer original"
                style={{
                  clipPath: cutoutUrl
                    ? `inset(0 ${100 - pos}% 0 0)`
                    : "inset(0)",
                  opacity: cutoutUrl ? 1 : 0.55,
                }}
              >
                <img src={originalUrl} alt="Original" />
              </div>

              {cutoutUrl && (
                <>
                  <div className="tag l">Before</div>
                  <div className="tag r">After</div>
                  <div className="handle" style={{ left: `${pos}%` }}>
                    <div className="knob">⇆</div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={pos}
                    aria-label="Reveal slider"
                    onChange={(e) => setPos(Number(e.target.value))}
                  />
                </>
              )}
            </div>
          )}

          {phase === "done" && (
            <div className="fmt-row">
              {(Object.keys(FMT_LABEL) as Fmt[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`fmt-btn${fmt === f ? " on" : ""}`}
                  onClick={() => setFmt(f)}
                  title={f === "image/png" ? "Keeps transparency" : "Adds a white background"}
                >
                  {FMT_LABEL[f]}
                </button>
              ))}
            </div>
          )}

          <div className="actions">
            {phase === "done" && (
              <button className="btn primary" type="button" onClick={download} disabled={downloading}>
                {downloading ? "Preparing…" : `Download ${FMT_LABEL[fmt]}`}
              </button>
            )}
            <button className="btn" type="button" onClick={reset}>
              {phase === "error" ? "Try again" : "New image"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
