import { useState } from 'react'
import './LoginScreen.css'

function simpleHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0
  return h.toString(36)
}

function PinDots({ pin, length = 4 }) {
  return (
    <div className="pin-dots">
      {Array.from({ length }).map((_, i) => (
        <span key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
      ))}
    </div>
  )
}

function PinPad({ onDigit, onDelete }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','del']
  return (
    <div className="pin-pad">
      {keys.map((k, i) => (
        k === '' ? <div key={i} /> :
        k === 'del' ? (
          <button key={i} className="pin-key del" onClick={onDelete}>⌫</button>
        ) : (
          <button key={i} className="pin-key" onClick={() => onDigit(k)}>{k}</button>
        )
      ))}
    </div>
  )
}

// ── PIN setup (step 2 of first-time setup) ──────────────────────────────────
function PinSetup({ onDone }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState(1) // 1=enter, 2=confirm
  const [error, setError] = useState('')

  function handleDigit(d) {
    if (step === 1) {
      const next = pin + d
      setPin(next)
      if (next.length === 4) setStep(2)
    } else {
      const next = confirm + d
      setConfirm(next)
      if (next.length === 4) {
        if (next === pin) { onDone(pin) }
        else { setError('PINs did not match — try again'); setPin(''); setConfirm(''); setStep(1) }
      }
    }
  }

  function handleDelete() {
    if (step === 1) setPin(p => p.slice(0, -1))
    else setConfirm(c => c.slice(0, -1))
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">&#9635;</div>
        <h1 className="login-title">Set your PIN</h1>
        <p className="login-sub">{step === 1 ? 'Choose a 4-digit PIN for quick access' : 'Confirm your PIN'}</p>
        <PinDots pin={step === 1 ? pin : confirm} />
        {error && <p className="login-error">{error}</p>}
        <PinPad onDigit={handleDigit} onDelete={handleDelete} />
      </div>
    </div>
  )
}

// ── Main login screen ────────────────────────────────────────────────────────
export default function LoginScreen({ onLogin }) {
  const savedUsername = localStorage.getItem('tracker-username') || ''
  const hasPin        = !!localStorage.getItem('tracker-pin')
  const isReturning   = !!savedUsername && hasPin

  const [mode, setMode]               = useState(isReturning ? 'pin' : 'setup')
  const [pin, setPin]                 = useState('')
  const [username, setUsername]       = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [error, setError]             = useState('')
  const [setupStep, setSetupStep]     = useState(1) // 1=credentials, 2=set PIN

  // ── PIN login ──────────────────────────────────────────────────────────────
  function handlePinDigit(d) {
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length === 4) {
      const saved = localStorage.getItem('tracker-pin')
      if (next === saved) {
        onLogin(savedUsername)
      } else {
        setError('Wrong PIN')
        setTimeout(() => setPin(''), 700)
      }
    }
  }

  // ── Setup: credentials step ────────────────────────────────────────────────
  function handleSetupSubmit(e) {
    e.preventDefault()
    if (!username.trim())          { setError('Enter a username'); return }
    if (password.length < 4)       { setError('Password must be at least 4 characters'); return }
    if (password !== confirmPw)    { setError('Passwords do not match'); return }
    setError('')
    setSetupStep(2)
  }

  // ── Setup: PIN chosen ──────────────────────────────────────────────────────
  function handlePinChosen(chosenPin) {
    const syncKey = `${username.toLowerCase().trim()}-${simpleHash(password)}`
    localStorage.setItem('tracker-username', username.trim())
    localStorage.setItem('tracker-pin',      chosenPin)
    // Write syncKey into settings
    const existing = JSON.parse(localStorage.getItem('tracker-settings') || '{}')
    localStorage.setItem('tracker-settings', JSON.stringify({ ...existing, syncKey }))
    onLogin(username.trim())
  }

  function handleSignOut() {
    localStorage.removeItem('tracker-username')
    localStorage.removeItem('tracker-pin')
    setPin('')
    setMode('setup')
    setSetupStep(1)
    setUsername('')
    setPassword('')
    setConfirmPw('')
    setError('')
  }

  // ── Render: PIN setup (step 2) ─────────────────────────────────────────────
  if (mode === 'setup' && setupStep === 2) {
    return <PinSetup onDone={handlePinChosen} />
  }

  // ── Render: PIN login ──────────────────────────────────────────────────────
  if (mode === 'pin') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">&#9635;</div>
          <h1 className="login-title">Welcome back</h1>
          <p className="login-sub login-username">{savedUsername}</p>
          <PinDots pin={pin} />
          {error && <p className="login-error">{error}</p>}
          <PinPad onDigit={handlePinDigit} onDelete={() => { setPin(p => p.slice(0, -1)); setError('') }} />
          <button className="login-text-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </div>
    )
  }

  // ── Render: first-time setup ───────────────────────────────────────────────
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">&#9635;</div>
        <h1 className="login-title">Daily Tracker</h1>
        <p className="login-sub">Create your account</p>

        <form className="login-form" onSubmit={handleSetupSubmit}>
          <div className="login-field">
            <label className="login-label">Username</label>
            <input
              className="login-input"
              type="text"
              placeholder="e.g. aldo"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label className="login-label">Password</label>
            <div className="login-input-row">
              <input
                className="login-input"
                type={showPw ? 'text' : 'password'}
                placeholder="Min 4 characters"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                autoComplete="new-password"
              />
              <button type="button" className="login-show-btn" onClick={() => setShowPw(s => !s)}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="login-field">
            <label className="login-label">Confirm password</label>
            <input
              className="login-input"
              type={showPw ? 'text' : 'password'}
              placeholder="Repeat password"
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setError('') }}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn">Continue</button>
        </form>

        <p className="login-hint">Your password is used to secure your sync key — it's never stored.</p>
      </div>
    </div>
  )
}
