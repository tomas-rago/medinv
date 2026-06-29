import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Allow ngrok tunnels during local development
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok.io"],
  // @zxing ships modern JS (declares node >= 24) and Next does not transpile
  // node_modules by default, which breaks the scanner — and any page that
  // bundles it — on older mobile browsers. Transpile it to our browser target.
  transpilePackages: ["@zxing/library", "@zxing/browser"],
};

export default withNextIntl(nextConfig);
