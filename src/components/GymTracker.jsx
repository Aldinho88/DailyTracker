import { useLocalStorage } from '../hooks/useLocalStorage'
import './GymTracker.css'

const CATEGORIES = [
  { key: 'push',   label: 'Push',   color: '#3b82f6', muscles: ['Chest', 'Shoulders', 'Triceps'] },
  { key: 'pull',   label: 'Pull',   color: '#10b981', muscles: ['Back', 'Biceps', 'Rear Delts'] },
  { key: 'legs',   label: 'Legs',   color: '#f59e0b', muscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] },
  { key: 'core',   label: 'Core',   color: '#ec4899', muscles: ['Abs', 'Lower Back'] },
  { key: 'cardio', label: 'Cardio', color: '#06b6d4', muscles: ['Cardio', 'HIIT'] },
]

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toDateStr(date) {
  return date.toISOString().split('T')[0]
}

function getWeekDays() {
  const today = new Date()
  // Start week on Monday
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function categoryForMuscle(muscle) {
  return CATEGORIES.find(c => c.muscles.includes(muscle))
}

export default function GymTracker({ selectedDate }) {
  const [gymData, setGymData] = useLocalStorage('tracker-gym', {})

  const dateStr = toDateStr(selectedDate)
  const dayMuscles = gymData[dateStr] || []

  function toggle(muscle) {
    const current = gymData[dateStr] || []
    const updated = current.includes(muscle)
      ? current.filter(m => m !== muscle)
      : [...current, muscle]
    setGymData(prev => ({ ...prev, [dateStr]: updated }))
  }

  const weekDays = getWeekDays()
  const todayStr = toDateStr(new Date())

  // Compute weekly volume per category (number of distinct muscles)
  const weeklyStats = CATEGORIES.map(cat => {
    const totalMuscles = cat.muscles.length
    const worked = new Set()
    weekDays.forEach(d => {
      const ds = toDateStr(d)
      ;(gymData[ds] || []).forEach(m => { if (cat.muscles.includes(m)) worked.add(m) })
    })
    return { ...cat, worked: worked.size, total: totalMuscles }
  })

  const isToday = dateStr === todayStr
  const isPast = dateStr < todayStr

  return (
    <div className="gym-tracker">
      <div className="gym-header">
        <h2 className="section-title">Gym Log</h2>
        <span className="gym-date-label">
          {isToday ? 'Today' : isPast ? 'Past day' : 'Future day'}
        </span>
      </div>

      {/* Muscle toggles for selected day */}
      <div className="gym-categories">
        {CATEGORIES.map(cat => (
          <div key={cat.key} className="gym-category">
            <div className="gym-cat-label" style={{ color: cat.color }}>{cat.label}</div>
            <div className="gym-muscles">
              {cat.muscles.map(muscle => {
                const active = dayMuscles.includes(muscle)
                return (
                  <button
                    key={muscle}
                    className={`muscle-chip ${active ? 'active' : ''}`}
                    style={active ? { background: cat.color + '28', borderColor: cat.color, color: cat.color } : {}}
                    onClick={() => toggle(muscle)}
                  >
                    {active && <span className="muscle-check">&#10003;</span>}
                    {muscle}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Weekly summary grid */}
      <div className="gym-week-section">
        <div className="gym-week-title">This Week</div>
        <div className="gym-week-grid">
          {weekDays.map(d => {
            const ds = toDateStr(d)
            const muscles = gymData[ds] || []
            const isSelected = ds === dateStr
            const isT = ds === todayStr
            const workedCats = CATEGORIES.filter(cat => muscles.some(m => cat.muscles.includes(m)))
            const isRest = ds < todayStr && muscles.length === 0

            return (
              <div key={ds} className={`gym-week-day ${isSelected ? 'selected' : ''} ${isT ? 'today' : ''}`}>
                <div className="gym-week-day-name">{DAY_SHORT[d.getDay()]}</div>
                <div className="gym-week-day-num">{d.getDate()}</div>
                {muscles.length > 0 ? (
                  <div className="gym-week-dots">
                    {workedCats.map(cat => (
                      <span key={cat.key} className="gym-week-dot" style={{ background: cat.color }} title={cat.label} />
                    ))}
                  </div>
                ) : (
                  <div className="gym-week-rest">{isRest ? 'rest' : ''}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekly volume summary */}
      <div className="gym-volume-bars">
        {weeklyStats.map(cat => (
          <div key={cat.key} className="gym-vol-row">
            <span className="gym-vol-label" style={{ color: cat.color }}>{cat.label}</span>
            <div className="gym-vol-track">
              <div
                className="gym-vol-fill"
                style={{ width: `${(cat.worked / cat.total) * 100}%`, background: cat.color }}
              />
            </div>
            <span className="gym-vol-count">{cat.worked}/{cat.total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
