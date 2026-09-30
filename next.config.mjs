/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Next.js 16+ blocks cross-origin access to /_next/* (HMR, etc.) in dev.
  // Allow private LAN + known public hosts so other devices on the network
  // can open the Network URL without 403s. Production (`next start` / Docker)
  // does not use this guard.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "193.193.193.*",
  ],
}

export default nextConfig
