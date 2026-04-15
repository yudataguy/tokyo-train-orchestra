import type { NextConfig } from "next";

// Previously `output: 'export'` for static deployment, but that mode forbids
// API routes — which we now need for the OpenSky flight proxy (CORS-blocked
// when called directly from the browser). To restore static export, remove
// the /api/flights route and the FlightDataService.
const nextConfig: NextConfig = {};

export default nextConfig;
