/** @type {import('next').NextConfig} */
const nextConfig = {
  // The engine (lib/engine/kb-loader.mjs) pulls data/kb/layer-{5,8}.json in
  // via static `import`, so webpack bundles them into the serverless function
  // directly. No outputFileTracingIncludes is needed: the earlier ENOENT was a
  // runtime path-resolution mismatch (the dynamic readFileSync resolved to the
  // build-time /vercel/path0/data/kb/... path, absent from the Vercel lambda),
  // not a missing-from-bundle problem, so tracing the files in never fixed it.
}
export default nextConfig
