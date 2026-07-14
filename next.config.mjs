/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    "193.193.193.80",
    "193.193.193.141",
    "193.193.193.109",
  ],
}

export default nextConfig
