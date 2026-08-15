"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FMT_LABEL as LABEL, FMT_EXT as EXT, type Fmt } from "@/lib/image";
import BulkPanel, { type BulkResult } from "./BulkPanel";

function convertFile(file: File, f: Fmt): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      if (f === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode"))), f, 0.97);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode")); };
    image.src = url;
  });
}

export default function ImageConverter() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [over, setOver] = useState(false);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fmt, setFmt] = useState<Fmt>("image/webp");
  const [out, setOut] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (srcUrl) URL.revokeObjectURL(srcUrl);
      if (out) URL.revokeObjectURL(out.url);
    };
  }, [srcUrl, out]);

  const convert = useCallback((image: HTMLImageElement, f: Fmt) => {
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    if (f === "image/jpeg") {
      ctx.fillStyle = "#ffffff"; // JPG has no transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) setOut((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url: URL.createObjectURL(blob), blob };
        });
        setBusy(false);
      },
      f,
      0.97
    );
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setSrcUrl(url);
    setName(file.name);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      convert(image, fmt);
    };
    image.src = url;
  }, [convert, fmt]);

  useEffect(() => {
    if (img) convert(img, fmt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmt]);

  const reset = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (out) URL.revokeObjectURL(out.url);
    setImg(null);
    setSrcUrl(null);
    setOut(null);
    setName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const download = () => {
    if (!out) return;
    const a = document.createElement("a");
    a.href = out.url;
    a.download = name.replace(/\.[^.]+$/, "") + "." + EXT[fmt];
    a.click();
  };

  const bulkProcess = useCallback(
    async (file: File): Promise<BulkResult> => ({ blob: await convertFile(file, fmt), ext: EXT[fmt] }),
    [fmt]
  );

  return (
    <div className="tool">
      <div className="mode-row">
        <button type="button" className={`mode-btn${mode === "single" ? " on" : ""}`} onClick={() => setMode("single")}>Single image</button>
        <button type="button" className={`mode-btn${mode === "bulk" ? " on" : ""}`} onClick={() => setMode("bulk")}>Bulk (multiple)</button>
      </div>

      {mode === "bulk" ? (
        <>
          <div className="fmt-row">
            {(Object.keys(LABEL) as Fmt[]).map((f) => (
              <button key={f} type="button" className={`fmt-btn${fmt === f ? " on" : ""}`} onClick={() => setFmt(f)}>
                {LABEL[f]}
              </button>
            ))}
          </div>
          <BulkPanel
            process={bulkProcess}
            zipName="converted-images.zip"
            hint={`Every file converted to ${LABEL[fmt]}, in parallel`}
          />
        </>
      ) : !img ? (
        <div
          className={`drop${over ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        >
          <div className="drop-mark checker" />
          <h2 className="display">Drop an image to convert</h2>
          <p>PNG ⇄ JPG ⇄ WebP · converts in your browser</p>
          <button className="pick" type="button">Choose image</button>
          <input ref={inputRef} className="hidden-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="stage">
          <div className="meta mono">
            <span>{name}</span>
            {out && (<><span className="dot" /><span>→ {LABEL[fmt]}</span></>)}
          </div>

          <div className="fmt-row">
            {(Object.keys(LABEL) as Fmt[]).map((f) => (
              <button key={f} type="button" className={`fmt-btn${fmt === f ? " on" : ""}`} onClick={() => setFmt(f)}>
                {LABEL[f]}
              </button>
            ))}
          </div>

          {out && (
            <div className="preview checker">
              <img src={out.url} alt="Converted preview" />
            </div>
          )}

          <div className="actions">
            <button className="btn primary" type="button" onClick={download} disabled={busy || !out}>
              {busy ? "Working…" : `Download ${LABEL[fmt]}`}
            </button>
            <button className="btn" type="button" onClick={reset}>New image</button>
          </div>
        </div>
      )}
    </div>
  );
}
