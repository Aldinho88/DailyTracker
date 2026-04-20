import { useState, useRef } from 'react'
import './FoodLogger.css'

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack 1', 'Snack 2']

const SYSTEM_PROMPT = `You are a nutrition expert. The user will send you either a photo of food or a text description.
Identify all food items and estimate calories and macros.
Respond ONLY with valid JSON in this exact shape:
{
  "items": [{ "name": "string", "amount": "string", "calories": number, "protein": number, "carbs": number, "fat": number }],
  "total": { "calories": number, "protein": number, "carbs": number, "fat": number },
  "notes": "string or null"
}
All numbers are per the described serving. If you cannot identify food, return items:[] and explain in notes.`

async function analyzeFood(apiKey, imageBase64, mimeType, textInput) {
  const content = []
  if (imageBase64) {
    content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'low' } })
  }
  content.push({ type: 'text', text: textInput || 'What food is in this image? Estimate calories and macros.' })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content }],
      max_tokens: 600,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error ${res.status}`)
  }
  const data = await res.json()
  const raw  = data.choices[0].message.content.trim()
  return JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim())
}

function MacroBadge({ label, value, color }) {
  return (
    <div className="macro-badge" style={{ borderColor: color + '55', background: color + '18' }}>
      <span className="macro-val" style={{ color }}>{value}g</span>
      <span className="macro-lbl">{label}</span>
    </div>
  )
}

const EMPTY_MANUAL = { meal: 'Breakfast', description: '', calories: '', protein: '', carbs: '', fat: '' }

export default function FoodLogger({ apiKey, foodLog = [], onFoodLogChange }) {
  const [mode, setMode]       = useState('ai')   // 'ai' | 'manual'
  const [meal, setMeal]       = useState('Breakfast')

  // AI mode
  const [image, setImage]     = useState(null)
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')
  const fileRef = useRef()

  // Manual mode
  const [manual, setManual]   = useState(EMPTY_MANUAL)

  const todayStr   = new Date().toLocaleDateString()
  const todayLog   = foodLog.filter(e => e.date === todayStr)
  const todayTotals = todayLog.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.total.calories || 0),
      protein:  acc.protein  + (e.total.protein  || 0),
      carbs:    acc.carbs    + (e.total.carbs     || 0),
      fat:      acc.fat      + (e.total.fat       || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  function saveLog(newLog) { onFoodLogChange(newLog) }
  function addEntry(entry) { saveLog([entry, ...foodLog].slice(0, 200)) }
  function removeEntry(idx) { saveLog(foodLog.filter((_, i) => i !== idx)) }

  // ── AI handlers ──────────────────────────────────────────────────────────
  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target.result
      setImage({ base64: dataUrl.split(',')[1], mimeType: file.type, previewUrl: dataUrl })
      setResult(null); setError('')
    }
    reader.readAsDataURL(file)
  }

  async function handleAnalyze() {
    if (!apiKey?.trim()) { setError('Add your OpenAI API key in Settings first.'); return }
    if (!image && !text.trim()) { setError('Upload a photo or describe the food.'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      setResult(await analyzeFood(apiKey, image?.base64, image?.mimeType, text))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function handleAiSave() {
    if (!result) return
    addEntry({ date: todayStr, timestamp: Date.now(), meal, source: 'ai', total: result.total, items: result.items, text: text || null })
    setResult(null); setImage(null); setText(''); setError('')
  }

  // ── Manual handlers ───────────────────────────────────────────────────────
  function handleManualSave() {
    const cal = Number(manual.calories)
    if (!manual.description.trim() || !cal) { setError('Enter a description and calories.'); return }
    const total = { calories: cal, protein: Number(manual.protein) || 0, carbs: Number(manual.carbs) || 0, fat: Number(manual.fat) || 0 }
    addEntry({ date: todayStr, timestamp: Date.now(), meal: manual.meal, source: 'manual', total, items: [{ name: manual.description, amount: '', calories: cal, protein: total.protein, carbs: total.carbs, fat: total.fat }], text: manual.description })
    setManual(EMPTY_MANUAL); setError('')
  }

  // Group today's log by meal
  const byMeal = MEALS.reduce((acc, m) => { acc[m] = todayLog.filter(e => e.meal === m); return acc }, {})

  return (
    <div className="food-logger">
      <div className="food-logger-header">
        <h2 className="section-title">Food Logger</h2>
        <div className="food-mode-tabs">
          <button className={`food-tab ${mode === 'ai' ? 'on' : ''}`} onClick={() => { setMode('ai'); setError('') }}>AI Photo</button>
          <button className={`food-tab ${mode === 'manual' ? 'on' : ''}`} onClick={() => { setMode('manual'); setError('') }}>Manual</button>
        </div>
      </div>

      {/* Today summary */}
      {todayLog.length > 0 && (
        <div className="food-today-summary">
          <span className="food-today-label">Today so far</span>
          <div className="food-today-macros">
            <span className="food-today-cal">{Math.round(todayTotals.calories)} cal</span>
            <span className="food-today-macro">P {Math.round(todayTotals.protein)}g</span>
            <span className="food-today-macro">C {Math.round(todayTotals.carbs)}g</span>
            <span className="food-today-macro">F {Math.round(todayTotals.fat)}g</span>
          </div>
        </div>
      )}

      {/* Meal selector (shared) */}
      <div className="food-meal-tabs">
        {MEALS.map(m => (
          <button key={m}
            className={`food-meal-tab ${meal === m ? 'on' : ''}`}
            onClick={() => { setMeal(m); setManual(p => ({ ...p, meal: m })) }}
          >{m}</button>
        ))}
      </div>

      {/* ── AI Mode ── */}
      {mode === 'ai' && (
        <div className="food-input-area">
          {image ? (
            <div className="food-preview-wrap">
              <img src={image.previewUrl} className="food-preview" alt="food" />
              <button className="food-clear-img" onClick={() => setImage(null)}>&#215;</button>
            </div>
          ) : (
            <button className="food-upload-btn" onClick={() => fileRef.current.click()}>
              <span className="food-upload-icon">&#128247;</span>
              <span>Take or upload a photo</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

          <textarea className="food-text-input"
            placeholder="Or describe the food… e.g. '2 eggs, toast with butter, OJ'"
            value={text} onChange={e => setText(e.target.value)} rows={2} />

          <div className="food-actions">
            <button className="food-analyze-btn" onClick={handleAnalyze} disabled={loading}>
              {loading ? 'Analyzing…' : '✦ Analyze'}
            </button>
            {(image || text || result) && (
              <button className="food-clear-btn" onClick={() => { setImage(null); setText(''); setResult(null); setError('') }}>Clear</button>
            )}
          </div>
        </div>
      )}

      {/* ── Manual Mode ── */}
      {mode === 'manual' && (
        <div className="food-manual-form">
          <input className="food-manual-desc" placeholder="Food description (e.g. Chicken breast, rice, salad)"
            value={manual.description} onChange={e => setManual(p => ({ ...p, description: e.target.value }))} />
          <div className="food-manual-macros">
            <label className="food-manual-field">
              <span>Calories</span>
              <input type="number" min="0" placeholder="0"
                value={manual.calories} onChange={e => setManual(p => ({ ...p, calories: e.target.value }))} />
            </label>
            <label className="food-manual-field">
              <span>Protein g</span>
              <input type="number" min="0" placeholder="0"
                value={manual.protein} onChange={e => setManual(p => ({ ...p, protein: e.target.value }))} />
            </label>
            <label className="food-manual-field">
              <span>Carbs g</span>
              <input type="number" min="0" placeholder="0"
                value={manual.carbs} onChange={e => setManual(p => ({ ...p, carbs: e.target.value }))} />
            </label>
            <label className="food-manual-field">
              <span>Fat g</span>
              <input type="number" min="0" placeholder="0"
                value={manual.fat} onChange={e => setManual(p => ({ ...p, fat: e.target.value }))} />
            </label>
          </div>
          <button className="food-save-btn" onClick={handleManualSave}>+ Add to {manual.meal}</button>
        </div>
      )}

      {error && <p className="food-error">{error}</p>}

      {/* AI Result */}
      {result && mode === 'ai' && (
        <div className="food-result">
          {result.items.length > 0 && (
            <ul className="food-items-list">
              {result.items.map((item, i) => (
                <li key={i} className="food-item-row">
                  <span className="food-item-name">{item.name}</span>
                  <span className="food-item-amount">{item.amount}</span>
                  <span className="food-item-cal">{Math.round(item.calories)} cal</span>
                </li>
              ))}
            </ul>
          )}
          <div className="food-result-total">
            <span className="food-result-cal">{Math.round(result.total.calories)} cal</span>
            <div className="food-result-macros">
              <MacroBadge label="Protein" value={Math.round(result.total.protein)} color="#3b82f6" />
              <MacroBadge label="Carbs"   value={Math.round(result.total.carbs)}   color="#f59e0b" />
              <MacroBadge label="Fat"     value={Math.round(result.total.fat)}     color="#ec4899" />
            </div>
          </div>
          {result.notes && <p className="food-result-notes">{result.notes}</p>}
          <button className="food-save-btn" onClick={handleAiSave}>+ Add to {meal}</button>
        </div>
      )}

      {/* Today's log grouped by meal */}
      {todayLog.length > 0 && (
        <div className="food-log-section">
          {MEALS.filter(m => byMeal[m]?.length > 0).map(m => {
            const entries  = byMeal[m]
            const mealCals = entries.reduce((s, e) => s + e.total.calories, 0)
            return (
              <div key={m} className="food-log-meal-group">
                <div className="food-log-meal-header">
                  <span className="food-log-meal-name">{m}</span>
                  <span className="food-log-meal-cal">{Math.round(mealCals)} cal</span>
                </div>
                {entries.map((entry, i) => {
                  const globalIdx = foodLog.indexOf(entry)
                  return (
                    <div key={i} className="food-log-entry">
                      <span className="food-log-desc">{entry.items.map(it => it.name).join(', ') || entry.text}</span>
                      <span className="food-log-cal">{Math.round(entry.total.calories)} cal</span>
                      <button className="food-log-del" onClick={() => removeEntry(globalIdx)}>&#215;</button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
