/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The engine (lib/engine/kb-loader.mjs) reads data/kb/*.json at runtime
    // via fs.readFileSync. Next.js can't statically trace that dynamic path,
    // so the KB files are not shipped to the serverless function bundle on
    // Vercel — causing ENOENT for data/kb/layer-5.json (and the other layers).
    // Force-include the whole KB tree for the route that invokes the engine.
    // Next 14: this key lives under `experimental`.
    outputFileTracingIncludes: {
      '/api/prelude/complete': ['./data/kb/**/*.json'],
    },
  },
}
export default nextConfig
