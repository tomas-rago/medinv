import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Allow ngrok tunnels during local development
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok.io"],
};

export default withNextIntl(nextConfig);
