import { useMemo } from 'react'
import { getDayCompletion, toDateStr } from '../utils/goals'
import './CalendarHeatmap.css'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKS = 26

function buildWeeks() {
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  // Walk back to the Monday that starts our window
  const totalDays = WEEKS * 7
  const start = new Date(today)
  start.setDate(today.getDate() - totalDays + 1)
  const startDow = start.getDay()
  const alignBack = startDow === 0 ? 6 : startDow - 1
  start.setDate(start.getDate() - alignBack)

  const weeks = []
  let cur = new Date(start)

  while (weeks.length < WEEKS) {
    const week = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function cellColor(comp, isFuture) {
  if (isFuture) return 'transparent'
  if (!comp) return null // no goals — use CSS default
  const p = comp.pct
  if (p === 0)  return 'rgba(248,81,73,0.35)'
  if (p < 0.5)  return 'rgba(63,185,80,0.28)'
  if (p < 1)    return 'rgba(63,185,80,0.62)'
  return 'var(--success)'
}

export default function CalendarHeatmap({ goalsData, recurringGoals }) {
  const gymData = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('tracker-gym') || '{}') } catch { return {} }
  }, [goalsData])

  const weeks = useMemo(buildWeeks, [])
  const todayStr = toDateStr(new Date())

  // Month label per week column (show label when month changes)
  const monthLabels = useMemo(() => {
    return weeks.map((week, wi) => {
      const firstDay = week[0]
      if (wi === 0) return MONTHS[firstDay.getMonth()]
      const prevFirst = weeks[wi - 1][0]
      return firstDay.getMonth() !== prevFirst.getMonth()
        ? MONTHS[firstDay.getMonth()]
        : ''
    })
  }, [weeks])

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-header">
        <h2 className="section-title">Activity Heatmap</h2>
        <div className="heatmap-legend">
          <span className="legend-txt">Less</span>
          {[null, 0, 0.35, 0.75, 1].map((v, i) => (
            <div
              key={i}
              className="legend-cell"
              style={{ background: v === null ? undefined : cellColor({ pct: v }, false) }}
            />
          ))}
          <span className="legend-txt">More</span>
        </div>
      </div>

      <div className="heatmap-scroll">
        {/* Month row */}
        <div className="heatmap-month-row">
          <div className="heatmap-day-spacer" />
          {weeks.map((_, wi) => (
            <div key={wi} className="heatmap-month-cell">{monthLabels[wi]}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="heatmap-body">
          {/* Day-of-week labels */}
          <div className="heatmap-dow">
            {['Mon','','Wed','','Fri','','Sun'].map((l, i) => (
              <div key={i} className="heatmap-dow-label">{l}</div>
            ))}
          </div>

          {/* Week columns */}
          <div className="heatmap-grid">
            {weeks.map((week, wi) => (
              <div key={wi} className="heatmap-week-col">
                {week.map((d, di) => {
                  const ds = toDateStr(d)
                  const isFuture = ds > todayStr
                  const isToday = ds === todayStr
                  const comp = getDayCompletion(ds, goalsData, recurringGoals)
                  const hasGym = !isFuture && (gymData[ds] || []).length > 0
                  const bg = cellColor(comp, isFuture)
                  const title = isFuture
                    ? ds
                    : comp
                      ? `${ds}: ${comp.done}/${comp.total} goals${hasGym ? ' + gym' : ''}`
                      : `${ds}: no goals${hasGym ? ' + gym' : ''}`

                  return (
                    <div
                      key={di}
                      className={`heatmap-cell${isToday ? ' today' : ''}${isFuture ? ' future' : ''}`}
                      style={bg ? { background: bg } : {}}
                      title={title}
                    >
                      {hasGym && <span className="heatmap-gym-dot" />}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="heatmap-key">
        <span className="heatmap-key-item"><span className="heatmap-gym-dot inline" /> gym day</span>
        <span className="heatmap-key-item"><span className="heatmap-key-swatch" style={{background:'rgba(248,81,73,0.35)'}}/> 0% done</span>
        <span className="heatmap-key-item"><span className="heatmap-key-swatch" style={{background:'var(--success)'}}/> 100% done</span>
      </div>
    </div>
  )
}
