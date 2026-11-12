import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * This machine's own LAN IPv4 addresses, e.g. the "Network" URL that
 * `next dev` prints. Without them, opening the app via that URL leaves the
 * page unhydrated (inputs don't update the preview) and the dev client
 * eventually reloads the page, wiping the form.
 */
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((info) => info && info.family === "IPv4" && !info.internal)
  .map((info) => info!.address);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: lanAddresses,
};

export default nextConfig;
