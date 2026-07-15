import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // 'export' is required for Tauri static builds.
  // During `next dev` it is ignored, which allows rewrites to work.
  ...(!isDev && { output: "export" }),
  images: {
    unoptimized: true,
  },
  // Dev-only proxy: forward /api/* and /health/* to the FastAPI backend.
  // This avoids CORS errors when running the frontend in a browser during development.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8765/api/:path*",
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:8765/health",
      },
      {
        source: "/health/:path*",
        destination: "http://127.0.0.1:8765/health/:path*",
      },
    ];
  },
};

export default nextConfig;
