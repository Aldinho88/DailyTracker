import './BodyMetrics.css'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24))
  return diff
}

export default function BodyMetrics({ metrics, onUpdate }) {
  const { currentWeight, currentFat, goalWeight, weightUnit, goalDate } = metrics

  function update(field, value) {
    onUpdate(prev => ({ ...prev, [field]: value }))
  }

  const cw = parseFloat(currentWeight)
  const gw = parseFloat(goalWeight)
  const cf = parseFloat(currentFat)

  const tolose = (!isNaN(cw) && !isNaN(gw)) ? (cw - gw).toFixed(1) : null
  const weightProgress = (!isNaN(cw) && !isNaN(gw) && gw < cw)
    ? Math.min(100, Math.max(0, ((cw - gw) / cw) * 100 + (gw / cw) * 100))
    : null

  // Progress toward goal: how much of the "to lose" amount has been "completed"
  // We can't know starting weight unless we track it, so show % of goal achieved
  // Simple: if current < goal means goal met
  const goalMet = !isNaN(cw) && !isNaN(gw) && cw <= gw
  const progressPct = (!isNaN(cw) && !isNaN(gw) && gw < cw && cw > 0)
    ? Math.max(0, Math.min(100, (gw / cw) * 100))
    : goalMet ? 100 : 0

  return (
    <div className="body-metrics">
      <h2 className="metrics-title">Body Metrics</h2>

      <div className="unit-toggle">
        <button
          className={`unit-btn ${weightUnit === 'lbs' ? 'active' : ''}`}
          onClick={() => update('weightUnit', 'lbs')}
        >lbs</button>
        <button
          className={`unit-btn ${weightUnit === 'kg' ? 'active' : ''}`}
          onClick={() => update('weightUnit', 'kg')}
        >kg</button>
      </div>

      <div className="metrics-grid">
        <div className="metric-field">
          <label className="metric-label">Current Weight</label>
          <div className="metric-input-row">
            <input
              className="metric-input"
              type="number"
              step="0.1"
              min="0"
              placeholder="0"
              value={currentWeight}
              onChange={e => update('currentWeight', e.target.value)}
            />
            <span className="metric-unit">{weightUnit}</span>
          </div>
        </div>

        <div className="metric-field">
          <label className="metric-label">Body Fat</label>
          <div className="metric-input-row">
            <input
              className="metric-input"
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="0"
              value={currentFat}
              onChange={e => update('currentFat', e.target.value)}
            />
            <span className="metric-unit">%</span>
          </div>
        </div>

        <div className="metric-field full-width">
          <label className="metric-label">Goal Weight</label>
          <div className="metric-input-row">
            <input
              className="metric-input"
              type="number"
              step="0.1"
              min="0"
              placeholder="0"
              value={goalWeight}
              onChange={e => update('goalWeight', e.target.value)}
            />
            <span className="metric-unit">{weightUnit}</span>
          </div>
        </div>

        <div className="metric-field full-width">
          <label className="metric-label">Goal Date</label>
          <input
            className="metric-input date-input"
            type="date"
            value={goalDate || ''}
            onChange={e => update('goalDate', e.target.value)}
          />
        </div>
      </div>

      {goalDate && (() => {
        const days = daysUntil(goalDate)
        const past = days < 0
        const today = days === 0
        return (
          <div className={`days-until-banner ${past ? 'past' : today ? 'today' : ''}`}>
            <span className="days-until-number">
              {today ? '0' : Math.abs(days)}
            </span>
            <span className="days-until-label">
              {today ? 'Goal date is today!' : past ? `days past goal date` : `days until goal date`}
            </span>
          </div>
        )
      })()}

      {(tolose !== null || !isNaN(cf)) && (
        <>
          <hr className="metrics-divider" />
          <div className="metrics-stats">
            {!isNaN(cf) && (
              <div className="metric-stat-row">
                <span className="metric-stat-label">Lean mass</span>
                <span className="metric-stat-value">
                  {!isNaN(cw) ? ((cw * (1 - cf / 100)).toFixed(1) + ' ' + weightUnit) : '—'}
                </span>
              </div>
            )}
            {!isNaN(cf) && (
              <div className="metric-stat-row">
                <span className="metric-stat-label">Fat mass</span>
                <span className="metric-stat-value">
                  {!isNaN(cw) ? ((cw * (cf / 100)).toFixed(1) + ' ' + weightUnit) : '—'}
                </span>
              </div>
            )}
            {tolose !== null && (
              <div className="metric-stat-row">
                <span className="metric-stat-label">
                  {parseFloat(tolose) > 0 ? 'To goal' : parseFloat(tolose) < 0 ? 'Above goal' : 'At goal'}
                </span>
                <span className={`metric-stat-value ${parseFloat(tolose) > 0 ? 'warn' : parseFloat(tolose) < 0 ? 'danger' : 'success'}`}>
                  {Math.abs(tolose)} {weightUnit}
                </span>
              </div>
            )}
          </div>

          {tolose !== null && !isNaN(cw) && !isNaN(gw) && (
            <div className="weight-progress-bar">
              <div className="weight-progress-label">
                <span>Weight goal progress</span>
                <span>{goalMet ? '100%' : `${Math.round(progressPct)}%`}</span>
              </div>
              <div className="progress-bar-track">
                <div
                  className={`progress-bar-fill ${goalMet ? 'success' : ''}`}
                  style={{ width: `${goalMet ? 100 : progressPct}%` }}
                />
              </div>
              {goalMet && (
                <div className="goal-met-label">Goal weight reached!</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
