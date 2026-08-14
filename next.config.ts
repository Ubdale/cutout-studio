import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Next's own JS/CSS chunks are content-hashed, so it's safe to
        // cache them "forever" — a code change ships under a new
        // filename automatically.
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // onnxruntime-web (the engine behind background removal) can only
        // use SharedArrayBuffer + multi-threaded WASM when the page is
        // "cross-origin isolated". Without these two headers it silently
        // falls back to single-threaded WASM even on a many-core machine —
        // this is the single biggest lever for cutting inference time.
        //
        // COEP is set to "credentialless" rather than the stricter
        // "require-corp": require-corp would also block any future
        // AdSense/third-party ad iframe on this page (most ad networks
        // don't send the CORP header it demands). "credentialless" still
        // unlocks crossOriginIsolated but degrades gracefully — unsupported
        // browsers (older Safari) just ignore it and the page keeps working
        // at normal (non-isolated) speed instead of breaking.
        //
        // Scoped to /remove-background only, so it can't affect ads or
        // embeds on any other page.
        source: "/remove-background",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
