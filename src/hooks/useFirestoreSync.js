import { useEffect, useRef, useState, useCallback } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

export function useFirestoreSync(syncKey, onRemoteData) {
  const [status, setStatus] = useState('idle') // idle | connecting | synced | syncing | error
  const [lastSynced, setLastSynced] = useState(null)
  const lastWritten = useRef(null)

  useEffect(() => {
    const key = syncKey?.trim()
    if (!key || key.length < 4) { setStatus('idle'); return }

    setStatus('connecting')
    const docRef = doc(db, 'trackers', key)

    const unsub = onSnapshot(
      docRef,
      snap => {
        if (!snap.exists()) { setStatus('synced'); return }
        const remoteStr = JSON.stringify(snap.data())
        // Skip our own echo — we already set lastWritten when we wrote this
        if (remoteStr === lastWritten.current) { setStatus('synced'); return }
        // It's a real remote change — apply it and record it so we don't echo back
        lastWritten.current = remoteStr
        onRemoteData(snap.data())
        setStatus('synced')
        setLastSynced(new Date())
      },
      err => {
        console.error('Firestore sync error:', err)
        setStatus('error')
      }
    )
    return () => unsub()
  }, [syncKey])

  const write = useCallback(async (data) => {
    const key = syncKey?.trim()
    if (!key || key.length < 4) return
    const payload = { ...data, _updatedAt: new Date().toISOString() }
    const str = JSON.stringify(payload)
    if (str === lastWritten.current) return // nothing changed
    lastWritten.current = str
    setStatus('syncing')
    try {
      await setDoc(doc(db, 'trackers', key), payload)
      setStatus('synced')
      setLastSynced(new Date())
    } catch (err) {
      console.error('Firestore write error:', err)
      setStatus('error')
      lastWritten.current = null // allow retry
    }
  }, [syncKey])

  return { write, status, lastSynced }
}
