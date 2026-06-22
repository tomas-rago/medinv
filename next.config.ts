import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow ngrok tunnels during local development
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok.io"],
};

export default nextConfig;
