import { useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import './LoginScreen.css'

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

export default function LoginScreen({ onLogin }) {
  const savedUsername = localStorage.getItem('tracker-username') || ''

  const [mode, setMode]         = useState('entry')
  const [username, setUsername] = useState(savedUsername)
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [newPw, setNewPw]       = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  function clearError() { setError('') }

  function finishLogin(user, syncKey) {
    localStorage.setItem('tracker-username', user)
    localStorage.removeItem('tracker-pin')
    const existing = JSON.parse(localStorage.getItem('tracker-settings') || '{}')
    localStorage.setItem('tracker-settings', JSON.stringify({ ...existing, syncKey }))
    onLogin(user)
  }

  // ── Sign in ──────────────────────────────────────────────────────────────
  if (mode === 'signin') {
    async function handleSignIn(e) {
      e.preventDefault()
      if (!username.trim() || !password) { setError('Fill in all fields'); return }
      setLoading(true); setError('')
      try {
        const syncKey = await signIn(username.trim(), password)
        finishLogin(username.trim(), syncKey)
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
        finishLogin(username.trim(), syncKey)
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
        finishLogin(username.trim(), syncKey)
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

  // ── Entry ────────────────────────────────────────────────────────────────
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">&#9635;</div>
        <h1 className="login-title">Daily Tracker</h1>
        <p className="login-sub">Your personal fitness &amp; goals tracker</p>
        <div className="entry-btns">
          <button className="login-btn" onClick={() => { setMode('signin'); clearError() }}>Sign in</button>
          <button className="login-btn secondary" onClick={() => { setMode('signup'); clearError() }}>Create account</button>
        </div>
      </div>
    </div>
  )
}
