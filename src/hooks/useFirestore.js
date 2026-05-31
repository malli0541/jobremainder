import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

function getCollectionRef(path) {
  if (Array.isArray(path)) return collection(db, ...path)
  return collection(db, path)
}

function getDocRef(path, id) {
  if (Array.isArray(path)) return doc(db, ...path, id)
  return doc(db, path, id)
}

export function useCollection(path, userId) {
  const [docs, setDocs] = useState([])
  useEffect(() => {
    if (!path) return
    const colRef = getCollectionRef(path)
    let unsub = () => {}
    let handledError = false

    const handleErrorOnce = (label, err) => {
      // Avoid spamming the console with repeated permission errors
      if (handledError) return
      handledError = true
      console.warn(label, err)
      setDocs([])
      try { unsub && typeof unsub === 'function' && unsub() } catch (e) {}
    }

    if (Array.isArray(path)) {
      // user-scoped collection (e.g. ['users', userId, 'applications'])
      // Order by createdAt descending when available
      const q = query(colRef, orderBy('createdAt', 'desc'))
      unsub = onSnapshot(q, (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setDocs(items)
      }, (err) => handleErrorOnce('Firestore onSnapshot error (user-scoped):', err))
    } else {
      // top-level collection — filter by userId if provided
      if (!userId) return
      const q = query(colRef, where('userId', '==', userId), orderBy('createdAt', 'desc'))
      unsub = onSnapshot(q, (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setDocs(items)
      }, (err) => handleErrorOnce('Firestore onSnapshot error:', err))
    }

    return unsub
  }, [path, userId])
  return docs
}

export const addDocument = async (path, data) => addDoc(getCollectionRef(path), data)
export const updateDocument = async (path, id, data) => updateDoc(getDocRef(path, id), data)
export const deleteDocument = async (path, id) => deleteDoc(getDocRef(path, id))
