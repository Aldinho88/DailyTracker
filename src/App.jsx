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
import LoginScreen from './components/LoginScreen'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useFirestoreSync } from './hooks/useFirestoreSync'
import { toDateStr, appliesToDate, getDayCompletion } from './utils/goals'
import './App.css'

const STATUS_COLORS = { idle: '#8b949e', connecting: '#e3b341', syncing: '#e3b341', synced: '#3fb950', error: '#f85149' }
const STATUS_LABELS = { idle: 'Not syncing', connecting: 'Connecting…', syncing: 'Saving…', synced: 'Synced', error: 'Sync error' }

export default function App() {
  const [selectedDate, setSelectedDate]     = useState(new Date())
  const [goalsData, setGoalsData]           = useLocalStorage('tracker-goals', {})
  const [metrics, setMetrics]               = useLocalStorage('tracker-metrics', { currentWeight: '', currentFat: '', goalWeight: '', weightUnit: 'lbs' })
  const [recurringGoals, setRecurringGoals] = useLocalStorage('tracker-recurring', [])
  const [weightLog, setWeightLog]           = useLocalStorage('tracker-weight-log', [])
  const [gymData, setGymData]               = useLocalStorage('tracker-gym', {})
  const [notesData, setNotesData]           = useLocalStorage('tracker-notes', {})
  const [settings, setSettings]             = useLocalStorage('tracker-settings', { reminderEnabled: false, reminderTime: '08:00', userEmail: '', syncKey: '' })
  const [showSettings, setShowSettings]     = useState(false)
  const [loggedIn, setLoggedIn]             = useState(() => !!sessionStorage.getItem('tracker-session'))
  const [currentUser, setCurrentUser]       = useState(() => sessionStorage.getItem('tracker-session') || '')

  // ── Firestore sync ─────────────────────────────────────────────────────────
  const { write, status: syncStatus, lastSynced } = useFirestoreSync(
    settings.syncKey,
    remote => {
      if (remote['tracker-goals'])       setGoalsData(remote['tracker-goals'])
      if (remote['tracker-recurring'])   setRecurringGoals(remote['tracker-recurring'])
      if (remote['tracker-metrics'])     setMetrics(remote['tracker-metrics'])
      if (remote['tracker-weight-log'])  setWeightLog(remote['tracker-weight-log'])
      if (remote['tracker-gym'])         setGymData(remote['tracker-gym'])
      if (remote['tracker-notes'])       setNotesData(remote['tracker-notes'])
    }
  )

  function syncNow() {
    write({
      'tracker-goals':      goalsData,
      'tracker-recurring':  recurringGoals,
      'tracker-metrics':    metrics,
      'tracker-weight-log': weightLog,
      'tracker-gym':        gymData,
      'tracker-notes':      notesData,
    })
  }

  // Sync when user leaves the app (switches tab, locks phone, closes browser)
  useEffect(() => {
    if (!settings.syncKey?.trim()) return
    function handleVisibility() {
      if (document.visibilityState === 'hidden') syncNow()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [goalsData, recurringGoals, metrics, weightLog, gymData, notesData, settings.syncKey])

  // ── Daily goals ────────────────────────────────────────────────────────────
  const dateStr = toDateStr(selectedDate)
  const todayGoals = goalsData[dateStr]?.goals || []

  const todayRecurring = useMemo(() => {
    const recurringDone = goalsData[dateStr]?.recurring || {}
    return recurringGoals
      .filter(r => appliesToDate(r, selectedDate))
      .map(r => ({ ...r, completed: !!recurringDone[r.id] }))
  }, [recurringGoals, goalsData, dateStr, selectedDate])

  const totalCount     = todayGoals.length + todayRecurring.length
  const completedCount = todayGoals.filter(g => g.completed).length + todayRecurring.filter(r => r.completed).length
  const progress       = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const streak = useMemo(() => {
    let count = 0
    const ref = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(ref); d.setDate(ref.getDate() - i)
      const comp = getDayCompletion(toDateStr(d), goalsData, recurringGoals)
      if (!comp) break
      if (comp.pct >= 1) count++
      else break
    }
    return count
  }, [goalsData, recurringGoals])

  // ── Reminder ───────────────────────────────────────────────────────────────
  useEffect(() => {
    function check() {
      if (!settings.reminderEnabled) return
      if (Notification.permission === 'denied') return
      const [h, m] = (settings.reminderTime || '08:00').split(':').map(Number)
      const now = new Date(); const trigger = new Date(); trigger.setHours(h, m, 0, 0)
      const todayStr = toDateStr(now)
      if (now >= trigger && localStorage.getItem('tracker-last-notified') !== todayStr) {
        const send = () => { new Notification('Daily Tracker', { body: 'Time to check your daily goals!' }); localStorage.setItem('tracker-last-notified', todayStr) }
        if (Notification.permission === 'granted') send()
        else Notification.requestPermission().then(p => { if (p === 'granted') send() })
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
  function addGoal(text)          { updateGoals([...todayGoals, { id: crypto.randomUUID(), text, completed: false, timeOfDay: null }]) }
  function toggleGoal(id)         { updateGoals(todayGoals.map(g => g.id === id ? { ...g, completed: !g.completed } : g)) }
  function deleteGoal(id)         { updateGoals(todayGoals.filter(g => g.id !== id)) }
  function updateTimeOfDay(id, t) { updateGoals(todayGoals.map(g => g.id === id ? { ...g, timeOfDay: t } : g)) }

  function toggleRecurring(id) {
    setGoalsData(prev => {
      const day = prev[dateStr] || {}
      const rec = day.recurring || {}
      return { ...prev, [dateStr]: { ...day, goals: day.goals || [], recurring: { ...rec, [id]: !rec[id] } } }
    })
  }

  function handleLogin(username) {
    sessionStorage.setItem('tracker-session', username)
    setCurrentUser(username)
    setLoggedIn(true)
    // Re-read settings in case setup just wrote a new syncKey
    try {
      const s = JSON.parse(localStorage.getItem('tracker-settings') || '{}')
      if (s.syncKey) setSettings(prev => ({ ...prev, syncKey: s.syncKey }))
    } catch {}
  }

  function handleLogout() {
    sessionStorage.removeItem('tracker-session')
    setLoggedIn(false)
    setCurrentUser('')
  }

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />

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
          {settings.syncKey?.trim() && (
            <button
              className="sync-indicator"
              onClick={syncNow}
              title={`${STATUS_LABELS[syncStatus]}${lastSynced ? ` · ${lastSynced.toLocaleTimeString()}` : ''} · Click to sync now`}
            >
              <span className="sync-dot" style={{ background: STATUS_COLORS[syncStatus] }} />
              <span className="sync-label">{syncStatus === 'syncing' ? 'Saving…' : 'Sync'}</span>
            </button>
          )}
          <button className="settings-btn" onClick={() => setShowSettings(true)} title="Settings">&#9881;</button>
          <button className="logout-btn" onClick={handleLogout} title={`Sign out (${currentUser})`}>&#10006;</button>
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
              <DayNotes selectedDate={selectedDate} notes={notesData} onNotesChange={setNotesData} />
            </div>
          </div>

          <div className="right-panel">
            <div className="card">
              <BodyMetrics metrics={metrics} onUpdate={setMetrics} />
            </div>
            <div className="card">
              <WeightTracker
                entries={weightLog}
                onEntriesChange={setWeightLog}
                goalWeight={metrics.goalWeight}
                weightUnit={metrics.weightUnit || 'lbs'}
              />
            </div>
          </div>
        </div>

        <div className="card full-card">
          <GymTracker selectedDate={selectedDate} gymData={gymData} onGymDataChange={setGymData} />
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
          settings={settings}
          onSettingsChange={setSettings}
          syncStatus={syncStatus}
          lastSynced={lastSynced}
        />
      )}
    </div>
  )
}
