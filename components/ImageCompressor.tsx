"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Result = { url: string; blob: Blob; w: number; h: number };

export default function ImageCompressor() {
  const [over, setOver] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("");
  const [origSize, setOrigSize] = useState(0);
  const [quality, setQuality] = useState(0.7);
  const [maxW, setMaxW] = useState(0); // 0 = keep original width
  const [out, setOut] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (srcUrl) URL.revokeObjectURL(srcUrl);
      if (out) URL.revokeObjectURL(out.url);
    };
  }, [srcUrl, out]);

  const compress = useCallback(
    (image: HTMLImageElement, q: number, mw: number) => {
      setBusy(true);
      const scale = mw && image.naturalWidth > mw ? mw / image.naturalWidth : 1;
      const w = Math.round(image.naturalWidth * scale);
      const h = Math.round(image.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setOut((prev) => {
              if (prev) URL.revokeObjectURL(prev.url);
              return { url: URL.createObjectURL(blob), blob, w, h };
            });
          }
          setBusy(false);
        },
        "image/jpeg",
        q
      );
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
      const image = new Image();
      image.onload = () => {
        setImg(image);
        compress(image, quality, maxW);
      };
      image.src = url;
    },
    [compress, quality, maxW]
  );

  // re-compress when settings change
  useEffect(() => {
    if (img) compress(img, quality, maxW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, maxW]);

  const reset = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (out) URL.revokeObjectURL(out.url);
    setSrcUrl(null);
    setImg(null);
    setOut(null);
    setName("");
    setOrigSize(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const download = () => {
    if (!out) return;
    const a = document.createElement("a");
    a.href = out.url;
    a.download = name.replace(/\.[^.]+$/, "") + "-compressed.jpg";
    a.click();
  };

  const saved = out && origSize ? Math.max(0, Math.round((1 - out.blob.size / origSize) * 100)) : 0;

  return (
    <div className="tool">
      {!img ? (
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
            <label className="ctrl">
              <span>Quality: {Math.round(quality * 100)}%</span>
              <input type="range" min={10} max={100} value={quality * 100} onChange={(e) => setQuality(Number(e.target.value) / 100)} />
            </label>
            <label className="ctrl">
              <span>Max width: {maxW ? `${maxW}px` : "original"}</span>
              <input type="range" min={0} max={4000} step={100} value={maxW} onChange={(e) => setMaxW(Number(e.target.value))} />
            </label>
          </div>

          {out && (
            <div className="preview checker">
              <img src={out.url} alt="Compressed preview" />
            </div>
          )}

          <div className="actions">
            <button className="btn primary" type="button" onClick={download} disabled={busy || !out}>
              {busy ? "Working…" : "Download JPG"}
            </button>
            <button className="btn" type="button" onClick={reset}>New image</button>
          </div>
        </div>
      )}
    </div>
  );
}
