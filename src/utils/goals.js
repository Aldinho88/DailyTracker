export function appliesToDate(recurringGoal, date) {
  const dow = date.getDay() // 0=Sun, 6=Sat
  if (recurringGoal.days === 'daily') return true
  if (recurringGoal.days === 'weekdays') return dow >= 1 && dow <= 5
  if (recurringGoal.days === 'weekends') return dow === 0 || dow === 6
  if (Array.isArray(recurringGoal.days)) return recurringGoal.days.includes(dow)
  return false
}

export function getDayCompletion(dateStr, goalsData, recurringGoals) {
  const dayData = goalsData[dateStr] || {}
  const goals = dayData.goals || []
  const recurringDone = dayData.recurring || {}

  const date = new Date(dateStr + 'T12:00:00')
  const applicable = (recurringGoals || []).filter(r => appliesToDate(r, date))

  const total = goals.length + applicable.length
  if (total === 0) return null

  const done =
    goals.filter(g => g.completed).length +
    applicable.filter(r => recurringDone[r.id]).length

  return { done, total, pct: done / total }
}

export function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
