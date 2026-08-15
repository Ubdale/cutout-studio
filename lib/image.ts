// Shared client-side image helpers.
// Everything here runs on the device — no network, no upload.

export type Fmt = "image/png" | "image/jpeg" | "image/webp";

export const FMT_LABEL: Record<Fmt, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WebP",
};
export const FMT_EXT: Record<Fmt, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function outputFmt(type: string): Fmt {
  if (type === "image/webp") return "image/webp";
  if (type === "image/png") return "image/png";
  return "image/jpeg";
}

// createImageBitmap decodes off the main thread and uses far less memory
// than an <img> element — the key win on low-end phones. Falls back to
// <img> where the API (or from-image orientation) is unavailable.
export async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        /* fall through to <img> */
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("decode failed"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function sourceSize(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if ("naturalWidth" in src) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

// Free the decoded bitmap's memory as soon as we're done with it.
export function release(src: ImageBitmap | HTMLImageElement | null): void {
  if (src && "close" in src) {
    try {
      src.close();
    } catch {
      /* already closed */
    }
  }
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: Fmt,
  quality = 0.97
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
