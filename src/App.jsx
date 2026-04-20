import { useState, useMemo, useEffect } from 'react'
import DateNav from './components/DateNav'
import GoalList from './components/GoalList'
import BodyMetrics from './components/BodyMetrics'
import ProgressRing from './components/ProgressRing'
import WeightTracker from './components/WeightTracker'
import GymTracker from './components/GymTracker'
import DayNotes from './components/DayNotes'
import CalendarHeatmap from './components/CalendarHeatmap'
import SettingsModal from './components/SettingsModal'
import { useLocalStorage } from './hooks/useLocalStorage'
import { toDateStr, appliesToDate, getDayCompletion } from './utils/goals'
import './App.css'

export default function App() {
  const [selectedDate, setSelectedDate]     = useState(new Date())
  const [goalsData, setGoalsData]           = useLocalStorage('tracker-goals', {})
  const [metrics, setMetrics]               = useLocalStorage('tracker-metrics', { currentWeight: '', currentFat: '', goalWeight: '', weightUnit: 'lbs' })
  const [recurringGoals, setRecurringGoals] = useLocalStorage('tracker-recurring', [])
  const [settings]                          = useLocalStorage('tracker-settings', { reminderEnabled: false, reminderTime: '08:00' })
  const [showSettings, setShowSettings]     = useState(false)

  const dateStr = toDateStr(selectedDate)
  const todayGoals = goalsData[dateStr]?.goals || []

  // Recurring goals applicable to selected date with their completion state
  const todayRecurring = useMemo(() => {
    const recurringDone = goalsData[dateStr]?.recurring || {}
    return recurringGoals
      .filter(r => appliesToDate(r, selectedDate))
      .map(r => ({ ...r, completed: !!recurringDone[r.id] }))
  }, [recurringGoals, goalsData, dateStr, selectedDate])

  const totalCount     = todayGoals.length + todayRecurring.length
  const completedCount = todayGoals.filter(g => g.completed).length + todayRecurring.filter(r => r.completed).length
  const progress       = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // Streak: consecutive days (including today if done) where completion > 0%
  const streak = useMemo(() => {
    let count = 0
    const ref = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(ref)
      d.setDate(ref.getDate() - i)
      const ds = toDateStr(d)
      const comp = getDayCompletion(ds, goalsData, recurringGoals)
      if (!comp) break
      if (comp.pct >= 1) count++
      else break
    }
    return count
  }, [goalsData, recurringGoals])

  // Reminder check — runs every 60s while app is open
  useEffect(() => {
    function check() {
      if (!settings.reminderEnabled) return
      if (Notification.permission === 'denied') return
      const [h, m]  = (settings.reminderTime || '08:00').split(':').map(Number)
      const now     = new Date()
      const trigger = new Date(); trigger.setHours(h, m, 0, 0)
      const todayStr = toDateStr(now)
      const lastKey  = 'tracker-last-notified'
      if (now >= trigger && localStorage.getItem(lastKey) !== todayStr) {
        const send = () => {
          new Notification('Daily Tracker', { body: "Time to check your daily goals!" })
          localStorage.setItem(lastKey, todayStr)
        }
        if (Notification.permission === 'granted') {
          send()
        } else {
          Notification.requestPermission().then(p => { if (p === 'granted') send() })
        }
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [settings])

  // ── Goal mutations ─────────────────────────────────────────────────────────
  function updateGoals(newGoals) {
    setGoalsData(prev => ({ ...prev, [dateStr]: { ...prev[dateStr], goals: newGoals } }))
  }

  function addGoal(text) {
    updateGoals([...todayGoals, { id: crypto.randomUUID(), text, completed: false, timeOfDay: null }])
  }

  function toggleGoal(id) {
    updateGoals(todayGoals.map(g => g.id === id ? { ...g, completed: !g.completed } : g))
  }

  function deleteGoal(id) {
    updateGoals(todayGoals.filter(g => g.id !== id))
  }

  function updateTimeOfDay(id, timeOfDay) {
    updateGoals(todayGoals.map(g => g.id === id ? { ...g, timeOfDay } : g))
  }

  function toggleRecurring(id) {
    setGoalsData(prev => {
      const day = prev[dateStr] || {}
      const recurring = day.recurring || {}
      return { ...prev, [dateStr]: { ...day, goals: day.goals || [], recurring: { ...recurring, [id]: !recurring[id] } } }
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <span className="app-logo-icon">&#9635;</span>
          <h1>Daily Tracker</h1>
        </div>
        <div className="header-right">
          {streak > 0 && (
            <div className="streak-badge">
              <span className="streak-flame">&#9733;</span>
              {streak} day streak
            </div>
          )}
          <button className="settings-btn" onClick={() => setShowSettings(true)} title="Settings">&#9881;</button>
        </div>
      </header>

      <main className="app-main">
        <DateNav selectedDate={selectedDate} onDateChange={setSelectedDate} goalsData={goalsData} />

        <div className="content-grid">
          <div className="left-panel">
            <div className="card progress-card">
              <ProgressRing progress={progress} completed={completedCount} total={totalCount} />
            </div>
            <div className="card">
              <GoalList
                goals={todayGoals}
                recurringGoals={todayRecurring}
                onAdd={addGoal}
                onToggle={toggleGoal}
                onDelete={deleteGoal}
                onUpdateTimeOfDay={updateTimeOfDay}
                onToggleRecurring={toggleRecurring}
              />
            </div>
            <div className="card">
              <DayNotes selectedDate={selectedDate} />
            </div>
          </div>

          <div className="right-panel">
            <div className="card">
              <BodyMetrics metrics={metrics} onUpdate={setMetrics} />
            </div>
            <div className="card">
              <WeightTracker goalWeight={metrics.goalWeight} weightUnit={metrics.weightUnit || 'lbs'} />
            </div>
          </div>
        </div>

        <div className="card full-card">
          <GymTracker selectedDate={selectedDate} />
        </div>

        <div className="card full-card">
          <CalendarHeatmap goalsData={goalsData} recurringGoals={recurringGoals} />
        </div>
      </main>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          recurringGoals={recurringGoals}
          setRecurringGoals={setRecurringGoals}
        />
      )}
    </div>
  )
}
