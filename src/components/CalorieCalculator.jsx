import { useState } from 'react'
import './CalorieCalculator.css'

const ACTIVITY_LEVELS = [
  { value: 1.2,   label: 'Sedentary',        desc: 'Little or no exercise' },
  { value: 1.375, label: 'Lightly active',   desc: '1–3 days/wk' },
  { value: 1.55,  label: 'Moderately active',desc: '3–5 days/wk' },
  { value: 1.725, label: 'Very active',       desc: '6–7 days/wk' },
  { value: 1.9,   label: 'Extra active',      desc: 'Hard daily exercise or physical job' },
]

const TARGETS = [1, 2, 3, 4, 5]

function calcBMR({ gender, age, weightKg, heightCm }) {
  if (!gender || !age || !weightKg || !heightCm) return null
  const base = 10 * weightKg + 6.25 * heightCm - 5 * Number(age)
  return gender === 'male' ? base + 5 : base - 161
}

function toKg(weight, unit) {
  return unit === 'lbs' ? weight * 0.453592 : weight
}

function toCm(ft, inches) {
  return (Number(ft) * 30.48) + (Number(inches) * 2.54)
}

export default function CalorieCalculator({ profile, onProfileChange }) {
  const [showForm, setShowForm] = useState(!profile.age)

  function set(key, val) { onProfileChange(prev => ({ ...prev, [key]: val })) }

  const weightKg  = profile.weight ? toKg(Number(profile.weight), profile.weightUnit || 'lbs') : null
  const heightCm  = profile.heightUnit === 'cm'
    ? Number(profile.heightCm || 0)
    : toCm(profile.heightFt || 0, profile.heightIn || 0)

  const bmr  = weightKg && heightCm ? calcBMR({ gender: profile.gender, age: profile.age, weightKg, heightCm }) : null
  const tdee = bmr ? Math.round(bmr * Number(profile.activity || 1.2)) : null

  const minCal = profile.gender === 'female' ? 1200 : 1500

  return (
    <div className="calorie-calc">
      <div className="calorie-header">
        <h2 className="section-title">Calorie Calculator</h2>
        <button className="cc-toggle-btn" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Hide' : 'Edit profile'}
        </button>
      </div>

      {showForm && (
        <div className="cc-form">
          {/* Gender */}
          <div className="cc-row">
            <span className="cc-label">Gender</span>
            <div className="cc-gender-btns">
              {['male','female'].map(g => (
                <button key={g}
                  className={`cc-gender-btn ${profile.gender === g ? 'on' : ''}`}
                  onClick={() => set('gender', g)}
                >{g === 'male' ? 'Male' : 'Female'}</button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div className="cc-row">
            <label className="cc-label">Age</label>
            <input className="cc-input" type="number" min="10" max="120" placeholder="years"
              value={profile.age || ''}
              onChange={e => set('age', e.target.value)} />
          </div>

          {/* Height */}
          <div className="cc-row">
            <label className="cc-label">Height</label>
            <div className="cc-unit-toggle">
              {['imperial','cm'].map(u => (
                <button key={u}
                  className={`cc-unit-btn ${(profile.heightUnit || 'imperial') === u ? 'on' : ''}`}
                  onClick={() => set('heightUnit', u)}
                >{u === 'imperial' ? 'ft/in' : 'cm'}</button>
              ))}
            </div>
            {(profile.heightUnit || 'imperial') === 'imperial' ? (
              <div className="cc-dual-input">
                <input className="cc-input" type="number" min="0" max="9" placeholder="ft"
                  value={profile.heightFt || ''}
                  onChange={e => set('heightFt', e.target.value)} />
                <input className="cc-input" type="number" min="0" max="11" placeholder="in"
                  value={profile.heightIn || ''}
                  onChange={e => set('heightIn', e.target.value)} />
              </div>
            ) : (
              <input className="cc-input" type="number" min="50" max="300" placeholder="cm"
                value={profile.heightCm || ''}
                onChange={e => set('heightCm', e.target.value)} />
            )}
          </div>

          {/* Weight */}
          <div className="cc-row">
            <label className="cc-label">Current weight</label>
            <div className="cc-unit-toggle">
              {['lbs','kg'].map(u => (
                <button key={u}
                  className={`cc-unit-btn ${(profile.weightUnit || 'lbs') === u ? 'on' : ''}`}
                  onClick={() => set('weightUnit', u)}
                >{u}</button>
              ))}
            </div>
            <input className="cc-input" type="number" min="50" max="700" placeholder={profile.weightUnit || 'lbs'}
              value={profile.weight || ''}
              onChange={e => set('weight', e.target.value)} />
          </div>

          {/* Activity */}
          <div className="cc-row cc-row-col">
            <label className="cc-label">Activity level</label>
            <div className="cc-activity-list">
              {ACTIVITY_LEVELS.map(a => (
                <button key={a.value}
                  className={`cc-activity-btn ${Number(profile.activity) === a.value ? 'on' : ''}`}
                  onClick={() => set('activity', a.value)}
                >
                  <span className="cc-act-label">{a.label}</span>
                  <span className="cc-act-desc">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tdee ? (
        <div className="cc-results">
          <div className="cc-tdee">
            <span className="cc-tdee-label">Your maintenance calories (TDEE)</span>
            <span className="cc-tdee-value">{tdee.toLocaleString()} cal/day</span>
          </div>

          <table className="cc-table">
            <thead>
              <tr>
                <th>Goal</th>
                <th>Deficit</th>
                <th>Calories/day</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {TARGETS.map(lbs => {
                const deficit = lbs * 500
                const cals    = tdee - deficit
                const unsafe  = cals < minCal
                const extreme = lbs >= 4
                return (
                  <tr key={lbs} className={unsafe ? 'cc-row-warn' : extreme ? 'cc-row-caution' : ''}>
                    <td className="cc-target-cell">−{lbs} lb/wk</td>
                    <td className="cc-deficit-cell">−{deficit.toLocaleString()}</td>
                    <td className="cc-cals-cell">{unsafe ? `< ${minCal}` : cals.toLocaleString()}</td>
                    <td className="cc-flag-cell">
                      {unsafe   && <span className="cc-flag danger">Not safe</span>}
                      {!unsafe && extreme && <span className="cc-flag caution">Very aggressive</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="cc-note">1 lb of fat ≈ 3,500 calories · Safe limit is typically 1–2 lb/wk</p>
        </div>
      ) : (
        <p className="cc-empty">Fill in your profile above to see your calorie targets.</p>
      )}
    </div>
  )
}
