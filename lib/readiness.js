function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function timePercent(seasonStart, raceDate, today) {
  const elapsed = today - seasonStart
  const total = raceDate - seasonStart
  return clamp((elapsed / total) * 100, 0, 100)
}

export function readinessPercent(goal) {
  // Cadence and knee-pain-trend stubbed at 1.0 for v1
  const cadenceSignal = 1.0
  const kneePainSignal = 1.0

  const longestRunScore = goal.longestRunKm / goal.targetDistanceKm
  const monthlyVolumeScore = goal.monthlyKm / goal.monthlyTargetKm

  const score =
    (0.50 * longestRunScore +
     0.25 * monthlyVolumeScore +
     0.15 * cadenceSignal +
     0.10 * kneePainSignal) * 100

  return clamp(score, 0, 100)
}
