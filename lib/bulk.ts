// Shared bulk-processing engine used by every tool's "Bulk mode".
//
// Design goals (this is the part that beats paid bulk tools like
// TinyPNG/iLoveIMG's free tier):
//  - No upload round trip per file — everything runs on-device, so there's
//    no queueing on someone else's server and no per-file network latency.
//  - True parallelism, not one-at-a-time: several images are processed at
//    once, tuned to the device's core count instead of a fixed "2 at a time"
//    limit like most free web tools impose.
//  - No arbitrary file-count cap — the only ceiling is the browser's own
//    memory, so a batch of 100 works the same as a batch of 5.
//  - Nothing ever leaves the device, so there's no "files auto-deleted
//    after 1 hour" privacy tradeoff to think about.

export type QueueStatus = "queued" | "working" | "done" | "error";

export interface QueueItem<R> {
  id: string;
  file: File;
  status: QueueStatus;
  result?: R;
  error?: string;
}

export interface CancelToken {
  cancelled: boolean;
}

/**
 * Runs `worker` over `files` with at most `concurrency` in flight at once.
 * Calls `onUpdate` after every state change so the UI can render progress
 * incrementally instead of freezing until the whole batch finishes.
 */
export async function runQueue<R>(
  files: File[],
  worker: (file: File) => Promise<R>,
  opts: {
    concurrency: number;
    onUpdate: (items: QueueItem<R>[]) => void;
    signal?: CancelToken;
  }
): Promise<QueueItem<R>[]> {
  const items: QueueItem<R>[] = files.map((file, i) => ({
    id: `${i}-${file.name}-${file.size}-${file.lastModified}`,
    file,
    status: "queued",
  }));
  opts.onUpdate([...items]);

  let next = 0;
  const lanes = Math.max(1, Math.min(opts.concurrency, files.length));

  async function lane() {
    while (next < items.length) {
      if (opts.signal?.cancelled) return;
      const i = next++;
      items[i].status = "working";
      opts.onUpdate([...items]);
      try {
        items[i].result = await worker(items[i].file);
        items[i].status = "done";
      } catch (err) {
        items[i].status = "error";
        items[i].error = err instanceof Error ? err.message : "Could not process this file";
      }
      opts.onUpdate([...items]);
    }
  }

  await Promise.all(Array.from({ length: lanes }, lane));
  return items;
}

/**
 * How many files to run in parallel. Light canvas work (resize/convert/
 * compress) scales with CPU cores — those run on independent Worker
 * instances, so real parallelism is safe.
 *
 * Heavy WASM/ML work (background removal) is forced to exactly 1: the
 * underlying onnxruntime-web engine is a singleton that initializes once
 * per page. Two files starting at the same moment both trigger that
 * init concurrently, which throws "multiple calls to initWasm() detected"
 * and fails the whole batch — so this task type can't safely run more
 * than one at a time no matter how many cores are available.
 */
export function idealConcurrency(heavy = false): number {
  if (heavy) return 1;
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  return Math.max(2, Math.min(6, cores - 1));
}

export async function downloadZip(
  entries: { name: string; blob: Blob }[],
  zipName: string
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const e of entries) {
    // avoid silently overwriting same-named files inside the zip
    let name = e.name;
    let n = 1;
    while (used.has(name)) {
      name = e.name.replace(/(\.[^.]+)?$/, (ext) => `-${n++}${ext || ""}`);
    }
    used.add(name);
    zip.file(name, e.blob);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
}
