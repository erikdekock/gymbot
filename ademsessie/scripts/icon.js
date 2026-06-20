// Shared SVG for the app icon: the sky gradient with a luminous breathing orb,
// matching the prototype's palette. `orbScale` shrinks the orb for maskable
// icons so it stays inside the platform safe zone.
export function iconSVG(size = 512, orbScale = 1) {
  const c = size / 2
  const r = size * 0.30 * orbScale
  const glow = size * 0.34 * orbScale
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3f80ca"/>
      <stop offset="55%" stop-color="#69a5da"/>
      <stop offset="100%" stop-color="#a8cdec"/>
    </linearGradient>
    <radialGradient id="orb" cx="50%" cy="41%" r="60%">
      <stop offset="0%" stop-color="rgba(249,253,255,0.98)"/>
      <stop offset="40%" stop-color="rgba(184,218,246,0.72)"/>
      <stop offset="70%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(146,198,236,0.85)"/>
      <stop offset="62%" stop-color="rgba(146,198,236,0)"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#sky)"/>
  <circle cx="${c}" cy="${c}" r="${r + glow}" fill="url(#halo)"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="url(#orb)"/>
</svg>`
}
