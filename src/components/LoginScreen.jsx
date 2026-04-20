import { useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import './LoginScreen.css'

// SHA-256 hash using Web Crypto API
async function hashPassword(password) {
  const data = new TextEncoder().encode(password + ':daily-tracker-v1')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function signUp(username, password) {
  const ref = doc(db, 'users', username.toLowerCase())
  const existing = await getDoc(ref)
  if (existing.exists()) throw new Error('Username already taken — try signing in instead')
  const passwordHash = await hashPassword(password)
  const syncKey = crypto.randomUUID()
  await setDoc(ref, { passwordHash, syncKey, createdAt: new Date().toISOString() })
  return syncKey
}

async function signIn(username, password) {
  const ref = doc(db, 'users', username.toLowerCase())
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Account not found — create one first')
  const { passwordHash, syncKey } = snap.data()
  const hash = await hashPassword(password)
  if (hash !== passwordHash) throw new Error('Wrong password')
  return syncKey
}

async function resetPassword(username, oldPassword, newPassword) {
  const ref = doc(db, 'users', username.toLowerCase())
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Account not found')
  const hash = await hashPassword(oldPassword)
  if (hash !== snap.data().passwordHash) throw new Error('Current password is wrong')
  await setDoc(ref, { passwordHash: await hashPassword(newPassword), syncKey: snap.data().syncKey }, { merge: true })
  return snap.data().syncKey
}

// ── Sub-components ──────────────────────────────────────────────────────────

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
      {keys.map((k, i) =>
        k === '' ? <div key={i} /> :
        k === 'del'
          ? <button key={i} className="pin-key del" onClick={onDelete}>⌫</button>
          : <button key={i} className="pin-key" onClick={() => onDigit(k)}>{k}</button>
      )}
    </div>
  )
}

function PinSetup({ onDone, onSkip }) {
  const [pin, setPin]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep]   = useState(1)
  const [error, setError] = useState('')

  function handleDigit(d) {
    if (step === 1) {
      const next = pin + d; setPin(next)
      if (next.length === 4) setStep(2)
    } else {
      const next = confirm + d; setConfirm(next)
      if (next.length === 4) {
        if (next === pin) { onDone(pin) }
        else { setError('PINs did not match — try again'); setPin(''); setConfirm(''); setStep(1) }
      }
    }
  }
  function handleDelete() {
    if (step === 1) setPin(p => p.slice(0,-1))
    else setConfirm(c => c.slice(0,-1))
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
        <button className="login-text-btn" onClick={onSkip}>Skip for now</button>
      </div>
    </div>
  )
}

// ── Shared form fields ──────────────────────────────────────────────────────

function Field({ label, type, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className="login-field">
      <label className="login-label">{label}</label>
      <div className="login-input-row">
        <input
          className="login-input"
          type={isPassword && show ? 'text' : type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        {isPassword && (
          <button type="button" className="login-show-btn" onClick={() => setShow(s => !s)}>
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function LoginScreen({ onLogin }) {
  const savedUsername = localStorage.getItem('tracker-username') || ''
  const hasPin        = !!localStorage.getItem('tracker-pin')

  const [mode, setMode]         = useState(savedUsername && hasPin ? 'pin' : 'entry')
  const [username, setUsername] = useState(savedUsername)
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [newPw, setNewPw]       = useState('')
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [pendingSyncKey, setPendingSyncKey] = useState('')
  const [pendingUsername, setPendingUsername] = useState('')

  function clearError() { setError('') }

  // Called after Firestore auth succeeds — save locally, then set up PIN
  function afterAuth(user, syncKey) {
    setPendingUsername(user)
    setPendingSyncKey(syncKey)
    setMode('setup-pin')
  }

  function finishLogin(user, syncKey, chosenPin) {
    localStorage.setItem('tracker-username', user)
    if (chosenPin) localStorage.setItem('tracker-pin', chosenPin)
    const existing = JSON.parse(localStorage.getItem('tracker-settings') || '{}')
    localStorage.setItem('tracker-settings', JSON.stringify({ ...existing, syncKey }))
    onLogin(user)
  }

  // ── PIN login ────────────────────────────────────────────────────────────
  if (mode === 'pin') {
    function handlePinDigit(d) {
      const next = pin + d; setPin(next); clearError()
      if (next.length === 4) {
        if (next === localStorage.getItem('tracker-pin')) {
          sessionStorage.setItem('tracker-session', savedUsername)
          onLogin(savedUsername)
        } else {
          setError('Wrong PIN')
          setTimeout(() => setPin(''), 700)
        }
      }
    }
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">&#9635;</div>
          <h1 className="login-title">Welcome back</h1>
          <p className="login-sub login-username">{savedUsername}</p>
          <PinDots pin={pin} />
          {error && <p className="login-error">{error}</p>}
          <PinPad onDigit={handlePinDigit} onDelete={() => { setPin(p => p.slice(0,-1)); clearError() }} />
          <button className="login-text-btn" onClick={() => {
            localStorage.removeItem('tracker-pin')
            setPin(''); setPassword(''); setMode('entry')
          }}>Use password instead</button>
        </div>
      </div>
    )
  }

  // ── PIN setup after auth ─────────────────────────────────────────────────
  if (mode === 'setup-pin') {
    return (
      <PinSetup
        onDone={pin => finishLogin(pendingUsername, pendingSyncKey, pin)}
        onSkip={() => finishLogin(pendingUsername, pendingSyncKey, null)}
      />
    )
  }

  // ── Sign in ──────────────────────────────────────────────────────────────
  if (mode === 'signin') {
    async function handleSignIn(e) {
      e.preventDefault()
      if (!username.trim() || !password) { setError('Fill in all fields'); return }
      setLoading(true); setError('')
      try {
        const syncKey = await signIn(username.trim(), password)
        afterAuth(username.trim(), syncKey)
      } catch (err) { setError(err.message) }
      finally { setLoading(false) }
    }
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">&#9635;</div>
          <h1 className="login-title">Sign in</h1>
          <form className="login-form" onSubmit={handleSignIn}>
            <Field label="Username" type="text" value={username} onChange={setUsername} placeholder="Your username" autoComplete="username" />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <button className="login-text-btn" onClick={() => { setMode('reset'); clearError() }}>Forgot password?</button>
          <button className="login-text-btn" onClick={() => { setMode('entry'); clearError() }}>← Back</button>
        </div>
      </div>
    )
  }

  // ── Sign up ──────────────────────────────────────────────────────────────
  if (mode === 'signup') {
    async function handleSignUp(e) {
      e.preventDefault()
      if (!username.trim())       { setError('Enter a username'); return }
      if (password.length < 4)    { setError('Password must be at least 4 characters'); return }
      if (password !== confirmPw) { setError('Passwords do not match'); return }
      setLoading(true); setError('')
      try {
        const syncKey = await signUp(username.trim(), password)
        afterAuth(username.trim(), syncKey)
      } catch (err) { setError(err.message) }
      finally { setLoading(false) }
    }
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">&#9635;</div>
          <h1 className="login-title">Create account</h1>
          <form className="login-form" onSubmit={handleSignUp}>
            <Field label="Username" type="text" value={username} onChange={setUsername} placeholder="e.g. aldo" autoComplete="username" />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Min 4 characters" autoComplete="new-password" />
            <Field label="Confirm password" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="Repeat password" autoComplete="new-password" />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
          </form>
          <button className="login-text-btn" onClick={() => { setMode('entry'); clearError() }}>← Back</button>
        </div>
      </div>
    )
  }

  // ── Reset password ───────────────────────────────────────────────────────
  if (mode === 'reset') {
    async function handleReset(e) {
      e.preventDefault()
      if (!username.trim() || !password || !newPw) { setError('Fill in all fields'); return }
      if (newPw.length < 4) { setError('New password must be at least 4 characters'); return }
      setLoading(true); setError('')
      try {
        const syncKey = await resetPassword(username.trim(), password, newPw)
        afterAuth(username.trim(), syncKey)
      } catch (err) { setError(err.message) }
      finally { setLoading(false) }
    }
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">&#9635;</div>
          <h1 className="login-title">Reset password</h1>
          <form className="login-form" onSubmit={handleReset}>
            <Field label="Username" type="text" value={username} onChange={setUsername} placeholder="Your username" autoComplete="username" />
            <Field label="Current password" type="password" value={password} onChange={setPassword} placeholder="Current password" autoComplete="current-password" />
            <Field label="New password" type="password" value={newPw} onChange={setNewPw} placeholder="New password" autoComplete="new-password" />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Saving…' : 'Reset password'}</button>
          </form>
          <button className="login-text-btn" onClick={() => { setMode('signin'); clearError() }}>← Back</button>
        </div>
      </div>
    )
  }

  // ── Entry (choose sign in or sign up) ────────────────────────────────────
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">&#9635;</div>
        <h1 className="login-title">Daily Tracker</h1>
        <p className="login-sub">Your personal fitness & goals tracker</p>
        <div className="entry-btns">
          <button className="login-btn" onClick={() => { setMode('signin'); clearError() }}>Sign in</button>
          <button className="login-btn secondary" onClick={() => { setMode('signup'); clearError() }}>Create account</button>
        </div>
      </div>
    </div>
  )
}
