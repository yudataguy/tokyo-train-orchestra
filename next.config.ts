import type { NextConfig } from "next";

// Static export: the whole app runs in the browser (IndexedDB-cached
// timetables + direct calls to ODPT/Open-Meteo with a public key), so
// there's no server work to do at runtime and this deploys to any pure
// static host.
const nextConfig: NextConfig = {
  output: 'export',
};

export default nextConfig;
