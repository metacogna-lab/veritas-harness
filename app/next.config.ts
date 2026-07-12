import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the workspace root to avoid false lockfile detection
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
