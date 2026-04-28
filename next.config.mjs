import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Pin Next.js' workspace-root inference to this directory; otherwise it
  // walks up and picks a parent lockfile.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
