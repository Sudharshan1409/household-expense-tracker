import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore - bypassing strict NextConfig type checking in case types are outdated
  allowedDevOrigins: ['192.168.0.124', '192.168.0.125', 'localhost'],
};

export default withPWA(nextConfig);
