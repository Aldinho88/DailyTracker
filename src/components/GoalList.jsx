import { useState } from 'react'
import './GoalList.css'

const TEMPLATES = [
  'Drink 8 glasses of water',
  'Exercise 30 min',
  'Read 20 pages',
  'Meditate 10 min',
  'Sleep 8 hours',
  'No junk food',
  'Walk 10,000 steps',
  'Stretch / mobility',
]

const TIME_CYCLE = [null, 'morning', 'afternoon', 'evening']
const TIME_COLORS = { morning: '#f59e0b', afternoon: '#3b82f6', evening: '#7c3aed' }
const TIME_LABELS = { morning: 'AM', afternoon: 'PM', evening: 'Eve' }
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

const SCHEDULE_OPTIONS = [
  { value: 'none',     label: 'Today only' },
  { value: 'daily',    label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'custom',   label: 'Other' },
]

const TIME_OPTIONS = [
  { value: '',          label: 'Any time' },
  { value: 'morning',   label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening',   label: 'Evening' },
]

function DayPicker({ selected, onChange }) {
  function toggle(i) {
    const next = selected.includes(i) ? selected.filter(d => d !== i) : [...selected, i].sort((a,b)=>a-b)
    onChange(next)
  }
  return (
    <div className="day-picker-row">
      {DOW.map((label, i) => (
        <button key={i} type="button"
          className={`day-pick-btn ${selected.includes(i) ? 'on' : ''}`}
          onClick={() => toggle(i)}>{label}</button>
      ))}
    </div>
  )
}

export default function GoalList({
  goals, recurringGoals = [], habitWeeklyStats = {},
  onAdd, onAddRecurring, onToggle, onDelete, onUpdateTimeOfDay, onEditGoal,
  onToggleRecurring, onUpdateRecurringTimeOfDay, onEditRecurring, onDeleteRecurring,
}) {
  const [input, setInput]           = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [schedule, setSchedule]     = useState('none')
  const [timeOfDay, setTimeOfDay]   = useState('')
  const [customDays, setCustomDays] = useState([1,2,3,4,5])
  const [timesPerWeek, setTimesPerWeek] = useState('')

  const [editingId, setEditingId]   = useState(null)
  const [editingText, setEditingText] = useState('')

  function startEdit(id, text) { setEditingId(id); setEditingText(text) }
  function commitEdit(save, id, saveFn) {
    if (save && editingText.trim()) saveFn(id, editingText)
    setEditingId(null); setEditingText('')
  }

  function handleAdd(text) {
    const trimmed = (text || input).trim()
    if (!trimmed) return

    if (schedule === 'none') {
      onAdd(trimmed, timeOfDay || null)
    } else {
      const days = schedule === 'custom' ? (customDays.length ? customDays : [1,2,3,4,5]) : schedule
      onAddRecurring({ text: trimmed, days, timeOfDay: timeOfDay || null, timesPerWeek: timesPerWeek ? Number(timesPerWeek) : null })
    }

    setInput('')
    setShowTemplates(false)
    setSchedule('none')
    setTimeOfDay('')
    setCustomDays([1,2,3,4,5])
    setTimesPerWeek('')
  }

  function cycleTime(goal) {
    const idx  = TIME_CYCLE.indexOf(goal.timeOfDay ?? null)
    const next = TIME_CYCLE[(idx + 1) % TIME_CYCLE.length]
    onUpdateTimeOfDay(goal.id, next)
  }

  const allTexts        = [...goals.map(g => g.text), ...recurringGoals.map(r => r.text)]
  const unusedTemplates = TEMPLATES.filter(t => !allTexts.includes(t))
  const totalCount      = goals.length + recurringGoals.length
  const completedCount  = goals.filter(g => g.completed).length + recurringGoals.filter(r => r.completed).length

  return (
    <div className="goal-list">
      <div className="goal-list-header">
        <h2 className="goal-list-title">Daily Goals</h2>
        <span className="goal-count">{completedCount} / {totalCount}</span>
      </div>

      {/* Add form */}
      <div className="add-goal-form">
        <input
          className="add-goal-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add a goal or habit..."
        />
        <button className="add-btn" onClick={() => handleAdd()}>Add</button>
        <button
          className={`template-btn ${showTemplates ? 'active' : ''}`}
          onClick={() => setShowTemplates(s => !s)}
          title="Quick add templates"
        >&#9776;</button>
      </div>

      {/* Add options row */}
      <div className="add-goal-options">
        <select className="add-opt-select" value={schedule} onChange={e => setSchedule(e.target.value)}>
          {SCHEDULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="add-opt-select" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)}>
          {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {schedule === 'custom' && (
          <label className="add-opt-freq-label">
            Goal:
            <input
              className="add-opt-num"
              type="number"
              min="1"
              max="7"
              placeholder="—"
              value={timesPerWeek}
              onChange={e => setTimesPerWeek(e.target.value)}
            />
            days/wk
          </label>
        )}
      </div>

      {schedule === 'custom' && (
        <DayPicker selected={customDays} onChange={setCustomDays} />
      )}

      {showTemplates && unusedTemplates.length > 0 && (
        <div className="templates-panel">
          <div className="templates-label">Quick add</div>
          <div className="templates-grid">
            {unusedTemplates.map(t => (
              <button key={t} className="template-chip" onClick={() => handleAdd(t)}>+ {t}</button>
            ))}
          </div>
        </div>
      )}

      {/* Recurring habits */}
      {recurringGoals.length > 0 && (
        <div className="recurring-section">
          <div className="recurring-label">Habits</div>
          <ul className="goals-ul">
            {recurringGoals.map(r => {
              const ws = habitWeeklyStats[r.id]
              return (
                <li key={r.id} className={`goal-item ${r.completed ? 'completed' : ''}`}>
                  <button className="goal-checkbox" onClick={() => onToggleRecurring(r.id)}>
                    {r.completed && <span className="goal-check">&#10003;</span>}
                  </button>
                  {editingId === r.id ? (
                    <input className="goal-inline-edit" value={editingText} autoFocus
                      onChange={e => setEditingText(e.target.value)}
                      onBlur={() => commitEdit(true, r.id, onEditRecurring)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit(true, r.id, onEditRecurring)
                        if (e.key === 'Escape') commitEdit(false)
                      }}
                    />
                  ) : (
                    <span className="goal-text" onDoubleClick={() => startEdit(r.id, r.text)}>{r.text}</span>
                  )}
                  {ws && (
                    <span className={`week-freq-badge ${ws.done >= ws.target ? 'done' : ''}`}>
                      {ws.done}/{ws.target}wk
                    </span>
                  )}
                  <button className="time-tag-btn"
                    onClick={() => {
                      const idx = TIME_CYCLE.indexOf(r.timeOfDay ?? null)
                      onUpdateRecurringTimeOfDay(r.id, TIME_CYCLE[(idx + 1) % TIME_CYCLE.length])
                    }}
                    style={r.timeOfDay ? { color: TIME_COLORS[r.timeOfDay], borderColor: TIME_COLORS[r.timeOfDay] + '60', background: TIME_COLORS[r.timeOfDay] + '18' } : {}}
                  >
                    {r.timeOfDay ? TIME_LABELS[r.timeOfDay] : '···'}
                  </button>
                  <button className="goal-delete" onClick={() => onDeleteRecurring(r.id)}>&#215;</button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Daily goals */}
      {goals.length === 0 && recurringGoals.length === 0 ? (
        <div className="goals-empty">
          <div className="goals-empty-icon">&#9744;</div>
          <div>No goals for this day</div>
          <div className="goals-empty-sub">Add a goal above to get started</div>
        </div>
      ) : goals.length > 0 ? (
        <ul className="goals-ul">
          {goals.map(goal => (
            <li key={goal.id} className={`goal-item ${goal.completed ? 'completed' : ''}`}>
              <button className="goal-checkbox" onClick={() => onToggle(goal.id)}>
                {goal.completed && <span className="goal-check">&#10003;</span>}
              </button>
              {editingId === goal.id ? (
                <input className="goal-inline-edit" value={editingText} autoFocus
                  onChange={e => setEditingText(e.target.value)}
                  onBlur={() => commitEdit(true, goal.id, onEditGoal)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit(true, goal.id, onEditGoal)
                    if (e.key === 'Escape') commitEdit(false)
                  }}
                />
              ) : (
                <span className="goal-text" onDoubleClick={() => startEdit(goal.id, goal.text)}>{goal.text}</span>
              )}
              <button className="time-tag-btn"
                onClick={() => cycleTime(goal)}
                style={goal.timeOfDay ? { color: TIME_COLORS[goal.timeOfDay], borderColor: TIME_COLORS[goal.timeOfDay] + '60', background: TIME_COLORS[goal.timeOfDay] + '18' } : {}}
              >
                {goal.timeOfDay ? TIME_LABELS[goal.timeOfDay] : '···'}
              </button>
              <button className="goal-delete" onClick={() => onDelete(goal.id)}>&#215;</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
