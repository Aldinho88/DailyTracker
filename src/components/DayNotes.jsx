import { toDateStr } from '../utils/goals'
import './DayNotes.css'

export default function DayNotes({ selectedDate, notes, onNotesChange }) {
  const dateStr = toDateStr(selectedDate)
  const value = notes[dateStr] || ''

  function handleChange(e) {
    const text = e.target.value
    onNotesChange(prev => ({ ...prev, [dateStr]: text }))
  }

  return (
    <div className="day-notes">
      <h2 className="section-title">Daily Notes</h2>
      <textarea
        className="notes-textarea"
        placeholder="How did the day go? Any wins, blockers, or thoughts..."
        value={value}
        onChange={handleChange}
        rows={4}
      />
    </div>
  )
}
