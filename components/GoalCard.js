'use client'

const SEASON_LABELS = {
  race: 'RACE',
  lean: 'LEAN',
  bulk: 'BULK',
  strength: 'STRENGTH',
  maintenance: 'MAINTENANCE',
}

export default function GoalCard({
  seasonType,
  name,
  meta,
  daysRemaining,
  timePercent,
  readinessPercent,
  onTap,
}) {
  const label = SEASON_LABELS[seasonType] || seasonType.toUpperCase()

  return (
    <div
      className="goal-card"
      onClick={() => {
        console.log('goal card tapped')
        if (onTap) onTap()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') console.log('goal card tapped') }}
    >
      <div className="goal-row">
        <span className="goal-icon" aria-hidden="true">🏁</span>
        <div className="goal-body">
          <div className="goal-label">{label}</div>
          <div className="goal-name">{name}</div>
          <div className="goal-meta">{meta}</div>
        </div>
        <div className="goal-count">
          <div className="goal-count-num">{daysRemaining}</div>
          <div className="goal-count-unit">days</div>
        </div>
      </div>

      <div className="goal-progress">
        <div className="progress-row">
          <span className="progress-label">Time</span>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={timePercent}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Time elapsed"
          >
            <div
              className="progress-fill progress-fill--time"
              style={{ width: `${timePercent}%` }}
            />
          </div>
          <span className="progress-pct">{timePercent}%</span>
        </div>

        <div className="progress-row">
          <span className="progress-label">Readiness</span>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={readinessPercent}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Readiness"
          >
            <div
              className="progress-fill progress-fill--ready"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
          <span className="progress-pct">{readinessPercent}%</span>
        </div>
      </div>
    </div>
  )
}
