import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { appliesToDate } from '../utils/goals'
import './SettingsModal.css'

const DAYS_OPTIONS = [
  { value: 'daily',    label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
]

const TIME_OPTIONS = [
  { value: '',          label: 'Any time' },
  { value: 'morning',   label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening',   label: 'Evening' },
]

function buildEmailBody(userEmail) {
  try {
    const goalsData  = JSON.parse(localStorage.getItem('tracker-goals')       || '{}')
    const weightLog  = JSON.parse(localStorage.getItem('tracker-weight-log')  || '[]')
    const gymData    = JSON.parse(localStorage.getItem('tracker-gym')         || '{}')
    const metrics    = JSON.parse(localStorage.getItem('tracker-metrics')     || '{}')
    const recurring  = JSON.parse(localStorage.getItem('tracker-recurring')   || '[]')
    const notes      = JSON.parse(localStorage.getItem('tracker-notes')       || '{}')

    const today = new Date().toISOString().split('T')[0]
    const dayData = goalsData[today] || {}
    const goals = dayData.goals || []
    const recurringDone = dayData.recurring || {}
    const date = new Date(today + 'T12:00:00')
    const applicable = recurring.filter(r => appliesToDate(r, date))

    let body = `DAILY TRACKER SUMMARY — ${today}\n`
    body += '='.repeat(40) + '\n\n'

    // Today's goals
    body += `TODAY'S GOALS\n`
    if (goals.length === 0 && applicable.length === 0) {
      body += '  (none logged)\n'
    } else {
      applicable.forEach(r => {
        body += `  [${recurringDone[r.id] ? 'x' : ' '}] ${r.text} (daily habit)\n`
      })
      goals.forEach(g => {
        body += `  [${g.completed ? 'x' : ' '}] ${g.text}${g.timeOfDay ? ` (${g.timeOfDay})` : ''}\n`
      })
    }

    // Notes
    const todayNote = notes[today]
    if (todayNote) {
      body += `\nNOTES\n  ${todayNote.replace(/\n/g, '\n  ')}\n`
    }

    // Weight
    if (weightLog.length > 0) {
      const last = weightLog[weightLog.length - 1]
      const unit = metrics.weightUnit || 'lbs'
      body += `\nWEIGHT\n`
      body += `  Current : ${last.weight} ${unit} (${last.date})\n`
      if (metrics.goalWeight) body += `  Goal    : ${metrics.goalWeight} ${unit}\n`
      if (metrics.currentFat) body += `  Body fat: ${metrics.currentFat}%\n`
      if (metrics.goalDate)   body += `  Goal date: ${metrics.goalDate}\n`
    }

    // This week gym
    const weekDays = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      weekDays.push(d.toISOString().split('T')[0])
    }
    const gymEntries = weekDays.filter(d => (gymData[d] || []).length > 0)
    if (gymEntries.length > 0) {
      body += `\nGYM THIS WEEK\n`
      gymEntries.forEach(d => {
        body += `  ${d}: ${gymData[d].join(', ')}\n`
      })
    }

    // Recent weight log
    if (weightLog.length > 1) {
      body += `\nRECENT WEIGHT LOG\n`
      weightLog.slice(-7).reverse().forEach(e => {
        body += `  ${e.date}: ${e.weight} ${metrics.weightUnit || 'lbs'}\n`
      })
    }

    return body
  } catch {
    return 'Could not generate summary.'
  }
}

const TRACKER_KEYS = [
  'tracker-goals',
  'tracker-recurring',
  'tracker-metrics',
  'tracker-weight-log',
  'tracker-gym',
  'tracker-notes',
  'tracker-settings',
]

function backupData() {
  const snapshot = {}
  TRACKER_KEYS.forEach(key => {
    const raw = localStorage.getItem(key)
    if (raw) snapshot[key] = JSON.parse(raw)
  })
  snapshot._exported = new Date().toISOString()
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `tracker-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function restoreData(file, onDone) {
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result)
      // Validate it looks like tracker data
      const hasAny = TRACKER_KEYS.some(k => k in data)
      if (!hasAny) { alert('This file does not look like a Daily Tracker backup.'); return }
      TRACKER_KEYS.forEach(key => {
        if (key in data) localStorage.setItem(key, JSON.stringify(data[key]))
      })
      onDone()
    } catch {
      alert('Could not read backup file — make sure it is a valid JSON backup.')
    }
  }
  reader.readAsText(file)
}

function exportCSV() {
  try {
    const goalsData = JSON.parse(localStorage.getItem('tracker-goals')      || '{}')
    const weightLog = JSON.parse(localStorage.getItem('tracker-weight-log') || '[]')
    const gymData   = JSON.parse(localStorage.getItem('tracker-gym')        || '{}')
    const metrics   = JSON.parse(localStorage.getItem('tracker-metrics')    || '{}')
    const unit      = metrics.weightUnit || 'lbs'

    const q = v => `"${String(v).replace(/"/g, '""')}"`

    let csv = 'GOALS\r\nDate,Goal,Completed,Time of Day\r\n'
    Object.entries(goalsData).sort().forEach(([date, day]) => {
      ;(day.goals || []).forEach(g => {
        csv += [q(date), q(g.text), q(g.completed ? 'Yes' : 'No'), q(g.timeOfDay || '')].join(',') + '\r\n'
      })
      const recurring = JSON.parse(localStorage.getItem('tracker-recurring') || '[]')
      const recurringDone = day.recurring || {}
      recurring.forEach(r => {
        if (recurringDone[r.id] !== undefined) {
          csv += [q(date), q(r.text + ' (habit)'), q(recurringDone[r.id] ? 'Yes' : 'No'), q(r.timeOfDay || '')].join(',') + '\r\n'
        }
      })
    })

    csv += '\r\nWEIGHT LOG\r\nDate,Weight,Unit\r\n'
    weightLog.forEach(e => { csv += [q(e.date), q(e.weight), q(unit)].join(',') + '\r\n' })

    csv += '\r\nGYM LOG\r\nDate,Muscles Worked\r\n'
    Object.entries(gymData).sort().forEach(([date, muscles]) => {
      csv += [q(date), q(muscles.join(', '))].join(',') + '\r\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `daily-tracker-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('Export failed: ' + e.message)
  }
}

export default function SettingsModal({ onClose, recurringGoals, setRecurringGoals }) {
  const [settings, setSettings] = useLocalStorage('tracker-settings', {
    reminderEnabled: false,
    reminderTime: '08:00',
    userEmail: '',
  })

  const [newHabit, setNewHabit]   = useState({ text: '', days: 'daily', timeOfDay: '' })
  const [emailSent, setEmailSent]   = useState(false)
  const [exported, setExported]     = useState(false)
  const [backed, setBacked]         = useState(false)
  const [restored, setRestored]     = useState(false)

  function updateSetting(key, val) {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  function addHabit() {
    if (!newHabit.text.trim()) return
    setRecurringGoals(prev => [
      ...prev,
      { id: crypto.randomUUID(), text: newHabit.text.trim(), days: newHabit.days, timeOfDay: newHabit.timeOfDay || null },
    ])
    setNewHabit({ text: '', days: 'daily', timeOfDay: '' })
  }

  function removeHabit(id) {
    setRecurringGoals(prev => prev.filter(r => r.id !== id))
  }

  function handleEmail() {
    const body    = buildEmailBody(settings.userEmail)
    const subject = encodeURIComponent(`Daily Tracker — ${new Date().toISOString().split('T')[0]}`)
    const encoded = encodeURIComponent(body)
    const to      = settings.userEmail ? encodeURIComponent(settings.userEmail) : ''
    window.location.href = `mailto:${to}?subject=${subject}&body=${encoded}`
    setEmailSent(true)
    setTimeout(() => setEmailSent(false), 3000)
  }

  function handleExport() {
    exportCSV()
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  const daysLabel = { daily: 'Daily', weekdays: 'Weekdays', weekends: 'Weekends' }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button className="modal-close" onClick={onClose}>&#215;</button>
        </div>

        <div className="modal-body">
          {/* ── Reminders ── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Reminders</h3>
            <p className="settings-hint">Shows a browser notification when the app is open.</p>

            <div className="settings-row">
              <label className="settings-label">Enable daily reminder</label>
              <button
                className={`toggle-btn ${settings.reminderEnabled ? 'on' : ''}`}
                onClick={() => updateSetting('reminderEnabled', !settings.reminderEnabled)}
              >
                <span className="toggle-knob" />
              </button>
            </div>

            {settings.reminderEnabled && (
              <div className="settings-row">
                <label className="settings-label">Reminder time</label>
                <input
                  type="time"
                  className="settings-input"
                  value={settings.reminderTime}
                  onChange={e => updateSetting('reminderTime', e.target.value)}
                />
              </div>
            )}
          </section>

          {/* ── Daily Habits ── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Daily Habits</h3>
            <p className="settings-hint">Habits auto-appear in your goal list every day they apply.</p>

            <div className="habit-add-form">
              <input
                className="settings-input habit-text-input"
                placeholder="Habit name..."
                value={newHabit.text}
                onChange={e => setNewHabit(p => ({ ...p, text: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addHabit()}
              />
              <select
                className="settings-select"
                value={newHabit.days}
                onChange={e => setNewHabit(p => ({ ...p, days: e.target.value }))}
              >
                {DAYS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select
                className="settings-select"
                value={newHabit.timeOfDay}
                onChange={e => setNewHabit(p => ({ ...p, timeOfDay: e.target.value }))}
              >
                {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button className="add-btn" onClick={addHabit}>Add</button>
            </div>

            {recurringGoals.length === 0 ? (
              <div className="settings-empty">No habits yet — add one above</div>
            ) : (
              <ul className="habit-list">
                {recurringGoals.map(r => (
                  <li key={r.id} className="habit-list-item">
                    <span className="habit-item-text">{r.text}</span>
                    <span className="habit-item-badge">{daysLabel[r.days] || r.days}</span>
                    {r.timeOfDay && <span className="habit-item-badge muted">{r.timeOfDay}</span>}
                    <button className="goal-delete visible" onClick={() => removeHabit(r.id)}>&#215;</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Backup & Restore ── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Backup &amp; Restore</h3>
            <p className="settings-hint">
              Save all your data to a file so it survives cache clears, browser changes, or new devices.
            </p>
            <div className="export-btns">
              <button
                className="export-btn"
                onClick={() => { backupData(); setBacked(true); setTimeout(() => setBacked(false), 3000) }}
              >
                {backed ? 'Saved!' : 'Download Backup'}
              </button>
              <label className={`export-btn restore-label ${restored ? 'success' : ''}`}>
                {restored ? 'Restored!' : 'Restore from File'}
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    restoreData(file, () => {
                      setRestored(true)
                      setTimeout(() => { setRestored(false); window.location.reload() }, 1200)
                    })
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            <p className="settings-hint">
              After restoring, the page reloads automatically to apply the data.
            </p>
          </section>

          {/* ── Export & Email ── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Export &amp; Email</h3>

            <div className="settings-row">
              <label className="settings-label">Your email (optional)</label>
              <input
                type="email"
                className="settings-input"
                placeholder="you@example.com"
                value={settings.userEmail}
                onChange={e => updateSetting('userEmail', e.target.value)}
              />
            </div>

            <div className="export-btns">
              <button className="export-btn" onClick={handleExport}>
                {exported ? 'Downloaded!' : 'Download CSV'}
              </button>
              <button className="export-btn email" onClick={handleEmail}>
                {emailSent ? 'Email opened!' : 'Send Summary Email'}
              </button>
            </div>
            <p className="settings-hint">
              CSV includes all goals, weight log, and gym data.<br />
              Email opens your mail app with a formatted summary.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
