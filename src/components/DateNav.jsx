import './DateNav.css'

function toDateStr(date) {
  return date.toISOString().split('T')[0]
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export default function DateNav({ selectedDate, onDateChange, goalsData }) {
  const today = new Date()
  const todayStr = toDateStr(today)
  const selectedStr = toDateStr(selectedDate)
  const isToday = selectedStr === todayStr

  function addDays(n) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + n)
    onDateChange(d)
  }

  // Build last 7 days dots starting from 6 days ago
  const weekDots = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = toDateStr(d)
    const goals = goalsData[ds]?.goals || []
    const total = goals.length
    const done = goals.filter(g => g.completed).length
    let status = 'empty'
    if (total > 0 && done === total) status = 'full'
    else if (total > 0 && done > 0) status = 'partial'
    else if (total > 0) status = 'none'
    weekDots.push({ ds, status, isSelected: ds === selectedStr, isToday: ds === todayStr })
  }

  return (
    <div className="date-nav">
      <button className="date-nav-btn" onClick={() => addDays(-1)} aria-label="Previous day">
        &#8249;
      </button>

      <div className="date-nav-center">
        <div className="date-nav-full">
          {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
        </div>
        <div className="date-nav-day">{DAY_NAMES[selectedDate.getDay()]}</div>
        <div className="week-dots">
          {weekDots.map(({ ds, status, isSelected, isToday: dot_today }) => (
            <button
              key={ds}
              className={`week-dot ${status} ${isSelected ? 'selected' : ''} ${dot_today ? 'today' : ''}`}
              onClick={() => onDateChange(new Date(ds + 'T12:00:00'))}
              aria-label={ds}
              title={ds}
            />
          ))}
        </div>
      </div>

      <div className="date-nav-right">
        {!isToday && (
          <button className="today-btn" onClick={() => onDateChange(new Date())}>
            Today
          </button>
        )}
        <button className="date-nav-btn" onClick={() => addDays(1)} aria-label="Next day">
          &#8250;
        </button>
      </div>
    </div>
  )
}
