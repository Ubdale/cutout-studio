"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Phase = "idle" | "working" | "done" | "error";

// Model choice: fp16 is ~half the download of the full isnet model and
// noticeably faster to run, with near-identical quality. Switch to
// "isnet_quint8" for the smallest, fastest option on very low-end phones.
const MODEL = "isnet_fp16" as const;

function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackgroundRemover() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pos, setPos] = useState(50);

  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
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
        await mod.preload?.({ model: MODEL });
      } catch {
        /* preload is best-effort */
      }
    });
    return () => w.cancelIdleCallback?.(id as number);
  }, []);

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

      // WebGPU is dramatically faster where the browser supports it;
      // fall back to CPU (WASM) everywhere else.
      const useGpu = typeof navigator !== "undefined" && "gpu" in navigator;

      const result = await removeBackground(file, {
        model: MODEL,
        device: useGpu ? "gpu" : "cpu",
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
  }, []);

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
    if (!cutoutBlob.current || !info) return;
    const url = URL.createObjectURL(cutoutBlob.current);
    const a = document.createElement("a");
    const base = info.name.replace(/\.[^.]+$/, "");
    a.href = url;
    a.download = `${base}-cutout.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const aspect = info && info.w && info.h ? `${info.w} / ${info.h}` : "4 / 3";

  return (
    <div className="tool">
      {phase === "idle" && (
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

      {phase !== "idle" && (
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

          <div className="actions">
            {phase === "done" && (
              <button className="btn primary" type="button" onClick={download}>
                Download PNG
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
