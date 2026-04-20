import './ProgressRing.css'

export default function ProgressRing({ progress, completed, total }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference
  const color = progress >= 100 ? 'var(--success)' : progress > 0 ? 'var(--accent)' : 'var(--border)'

  return (
    <div className="progress-ring-wrap">
      <div className="progress-ring-container">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={radius} fill="none" stroke="var(--surface2)" strokeWidth="11" />
          <circle
            cx="65" cy="65" r={radius} fill="none"
            stroke={color}
            strokeWidth="11"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 65 65)"
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div className="progress-ring-text">
          <span className="progress-percent">{Math.round(progress)}%</span>
          <span className="progress-label">{completed}/{total}</span>
        </div>
      </div>
      <div className="progress-ring-caption">
        {total === 0
          ? 'No goals yet'
          : progress >= 100
          ? 'All done!'
          : `${total - completed} remaining`}
      </div>
    </div>
  )
}
