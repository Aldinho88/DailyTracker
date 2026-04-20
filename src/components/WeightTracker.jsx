import { useState, useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import './WeightTracker.css'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export default function WeightTracker({ goalWeight, weightUnit }) {
  const [entries, setEntries] = useLocalStorage('tracker-weight-log', [])
  const [inputWeight, setInputWeight] = useState('')
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0])
  const [showAll, setShowAll] = useState(false)

  function addEntry() {
    const w = parseFloat(inputWeight)
    if (isNaN(w) || !inputDate) return
    const updated = [...entries.filter(e => e.date !== inputDate), { date: inputDate, weight: w, id: crypto.randomUUID() }]
      .sort((a, b) => a.date.localeCompare(b.date))
    setEntries(updated)
    setInputWeight('')
  }

  function removeEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const chartEntries = entries.slice(-30)
  const gw = parseFloat(goalWeight)

  const { minW, maxW } = useMemo(() => {
    if (!chartEntries.length) return { minW: 0, maxW: 100 }
    const weights = chartEntries.map(e => e.weight)
    const all = isNaN(gw) ? weights : [...weights, gw]
    const span = Math.max(...all) - Math.min(...all)
    const pad = Math.max(span * 0.15, 2)
    return { minW: Math.min(...all) - pad, maxW: Math.max(...all) + pad }
  }, [chartEntries, gw])

  const trend = useMemo(() => {
    if (entries.length < 4) return null
    const last = entries.slice(-7).map(e => e.weight)
    const prev = entries.slice(-14, -7).map(e => e.weight)
    if (!prev.length) return null
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
    return (avg(last) - avg(prev)).toFixed(1)
  }, [entries])

  // SVG dimensions
  const W = 560, H = 150
  const PL = 38, PR = 10, PT = 8, PB = 24

  function px(i, total) { return PL + (i / Math.max(total - 1, 1)) * (W - PL - PR) }
  function py(w) { return PT + (1 - (w - minW) / (maxW - minW)) * (H - PT - PB) }

  const pts = chartEntries.map((e, i) => `${px(i, chartEntries.length)},${py(e.weight)}`).join(' ')
  const areaPts = chartEntries.length > 1
    ? `${px(0, chartEntries.length)},${H - PB} ${pts} ${px(chartEntries.length - 1, chartEntries.length)},${H - PB}`
    : ''

  const displayList = showAll ? [...entries].reverse() : [...entries].reverse().slice(0, 8)

  return (
    <div className="weight-tracker">
      <h2 className="section-title">Weight Log</h2>

      <div className="wt-form">
        <input
          className="metric-input"
          type="number"
          step="0.1"
          min="0"
          placeholder={`Weight (${weightUnit})`}
          value={inputWeight}
          onChange={e => setInputWeight(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEntry()}
        />
        <input
          className="metric-input date-input"
          type="date"
          value={inputDate}
          onChange={e => setInputDate(e.target.value)}
        />
        <button className="add-btn" onClick={addEntry}>Log</button>
      </div>

      {entries.length === 0 && (
        <div className="wt-empty">Log your first weight entry to see your progress chart</div>
      )}

      {chartEntries.length > 1 && (
        <div className="wt-chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="wt-chart" preserveAspectRatio="none">
            <defs>
              <linearGradient id="wtGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Goal weight line */}
            {!isNaN(gw) && (
              <>
                <line x1={PL} y1={py(gw)} x2={W - PR} y2={py(gw)}
                  stroke="#3fb950" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.6" />
                <text x={W - PR - 2} y={py(gw) - 5} fill="#3fb950" fontSize="9" textAnchor="end" opacity="0.9">
                  goal {gw}{weightUnit}
                </text>
              </>
            )}

            {/* Area */}
            {areaPts && <polygon points={areaPts} fill="url(#wtGrad)" />}

            {/* Line */}
            <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" />

            {/* Dots */}
            {chartEntries.map((e, i) => (
              <circle key={e.id} cx={px(i, chartEntries.length)} cy={py(e.weight)}
                r="3.5" fill="#7c3aed" stroke="#161b22" strokeWidth="1.5" />
            ))}

            {/* Y axis */}
            {[0, 0.5, 1].map(t => {
              const w = minW + t * (maxW - minW)
              const y = py(w)
              return (
                <g key={t}>
                  <line x1={PL - 4} y1={y} x2={W - PR} y2={y} stroke="#30363d" strokeWidth="0.5" />
                  <text x={PL - 6} y={y + 4} fill="#8b949e" fontSize="9" textAnchor="end">
                    {Math.round(w)}
                  </text>
                </g>
              )
            })}

            {/* X axis labels */}
            {[0, Math.floor((chartEntries.length - 1) / 2), chartEntries.length - 1]
              .filter((v, i, a) => a.indexOf(v) === i && chartEntries[v])
              .map(i => (
                <text key={i} x={px(i, chartEntries.length)} y={H - 4}
                  fill="#8b949e" fontSize="9" textAnchor="middle">
                  {fmt(chartEntries[i].date)}
                </text>
              ))
            }
          </svg>
        </div>
      )}

      {entries.length > 0 && (
        <div className="wt-stats">
          <div className="wt-stat">
            <span className="wt-stat-val">{entries[entries.length - 1].weight}</span>
            <span className="wt-stat-lbl">current</span>
          </div>
          {!isNaN(gw) && (
            <div className="wt-stat">
              <span className={`wt-stat-val ${entries[entries.length - 1].weight <= gw ? 'success' : 'warn'}`}>
                {Math.abs(entries[entries.length - 1].weight - gw).toFixed(1)}
              </span>
              <span className="wt-stat-lbl">
                {entries[entries.length - 1].weight <= gw ? 'at/below goal' : 'to goal'}
              </span>
            </div>
          )}
          {trend !== null && (
            <div className="wt-stat">
              <span className={`wt-stat-val ${parseFloat(trend) < 0 ? 'success' : parseFloat(trend) > 0 ? 'warn' : ''}`}>
                {parseFloat(trend) > 0 ? '+' : ''}{trend}
              </span>
              <span className="wt-stat-lbl">7-day avg</span>
            </div>
          )}
          <div className="wt-stat">
            <span className="wt-stat-val success">{Math.min(...entries.map(e => e.weight))}</span>
            <span className="wt-stat-lbl">lowest</span>
          </div>
          <div className="wt-stat">
            <span className="wt-stat-val">{Math.max(...entries.map(e => e.weight))}</span>
            <span className="wt-stat-lbl">highest</span>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="wt-log">
          {displayList.map(e => (
            <div key={e.id} className="wt-log-item">
              <span className="wt-log-date">{fmt(e.date)}, {new Date(e.date + 'T12:00:00').getFullYear()}</span>
              <span className="wt-log-val">{e.weight} <span className="wt-log-unit">{weightUnit}</span></span>
              {!isNaN(gw) && (
                <span className={`wt-log-diff ${e.weight - gw < 0 ? 'success' : 'muted'}`}>
                  {e.weight - gw > 0 ? '+' : ''}{(e.weight - gw).toFixed(1)} vs goal
                </span>
              )}
              <button className="goal-delete" onClick={() => removeEntry(e.id)}>&#215;</button>
            </div>
          ))}
          {entries.length > 8 && (
            <button className="show-more-btn" onClick={() => setShowAll(s => !s)}>
              {showAll ? 'Show less' : `Show all ${entries.length} entries`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
