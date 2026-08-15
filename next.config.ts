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
      // NOTE: Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy were
      // added here to unlock multi-threaded WASM for background removal,
      // but they broke onnxruntime-web's WebGPU (JSEP) backend entirely —
      // "Failed to initialize JSEP" — on this library version. Reverted:
      // a working tool beats a theoretically faster broken one.
    ];
  },
};

export default nextConfig;
