import { useState, useRef } from 'react'
import './FoodLogger.css'

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
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      max_tokens: 600,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error ${res.status}`)
  }

  const data = await res.json()
  const raw  = data.choices[0].message.content.trim()
  const json = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  return JSON.parse(json)
}

function MacroBadge({ label, value, color }) {
  return (
    <div className="macro-badge" style={{ borderColor: color + '55', background: color + '18' }}>
      <span className="macro-val" style={{ color }}>{value}g</span>
      <span className="macro-lbl">{label}</span>
    </div>
  )
}

export default function FoodLogger({ apiKey, foodLog = [], onFoodLogChange }) {
  const [image, setImage]     = useState(null)
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')
  const fileRef = useRef()

  const log = foodLog
  function saveLog(newLog) { onFoodLogChange(newLog) }

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl  = e.target.result
      const base64   = dataUrl.split(',')[1]
      const mimeType = file.type
      setImage({ base64, mimeType, previewUrl: dataUrl })
      setResult(null)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  async function handleAnalyze() {
    if (!apiKey?.trim()) { setError('Add your OpenAI API key in Settings first.'); return }
    if (!image && !text.trim()) { setError('Upload a photo or describe the food.'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const data = await analyzeFood(apiKey, image?.base64, image?.mimeType, text)
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSave() {
    if (!result) return
    const today = new Date().toLocaleDateString()
    const entry = { date: today, timestamp: Date.now(), total: result.total, items: result.items, text: text || null }
    saveLog([entry, ...log].slice(0, 50))
    setResult(null); setImage(null); setText(''); setError('')
  }

  function handleClear() {
    setImage(null); setText(''); setResult(null); setError('')
  }

  const todayStr = new Date().toLocaleDateString()
  const todayLog = log.filter(e => e.date === todayStr)
  const todayTotals = todayLog.reduce(
    (acc, e) => ({ calories: acc.calories + e.total.calories, protein: acc.protein + e.total.protein, carbs: acc.carbs + e.total.carbs, fat: acc.fat + e.total.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  return (
    <div className="food-logger">
      <h2 className="section-title">Food Logger</h2>

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

      {/* Input area */}
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

        <textarea
          className="food-text-input"
          placeholder="Or describe the food... e.g. '2 eggs, toast with butter, orange juice'"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
        />

        <div className="food-actions">
          <button className="food-analyze-btn" onClick={handleAnalyze} disabled={loading}>
            {loading ? 'Analyzing…' : '✦ Analyze'}
          </button>
          {(image || text || result) && (
            <button className="food-clear-btn" onClick={handleClear}>Clear</button>
          )}
        </div>
      </div>

      {error && <p className="food-error">{error}</p>}

      {/* Result */}
      {result && (
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

          <button className="food-save-btn" onClick={handleSave}>+ Add to today's log</button>
        </div>
      )}

      {/* Today's log */}
      {todayLog.length > 0 && (
        <div className="food-log-section">
          <div className="food-log-label">Today's log</div>
          {todayLog.map((entry, i) => (
            <div key={i} className="food-log-entry">
              <span className="food-log-desc">{entry.items.map(it => it.name).join(', ') || entry.text}</span>
              <span className="food-log-cal">{Math.round(entry.total.calories)} cal</span>
              <button className="food-log-del" onClick={() => saveLog(log.filter((_, j) => j !== log.indexOf(entry)))}>&#215;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
