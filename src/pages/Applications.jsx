import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCollection, addDocument, deleteDocument, updateDocument } from '../hooks/useFirestore'
import { serverTimestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { useNotifications } from '../contexts/NotificationsContext'
import useUserSettings from '../hooks/useUserSettings'

export default function Applications(){
  const { user } = useAuth()
  if (!user) return <div className="p-6">Please sign in to manage applications.</div>

  const apps = useCollection(['users', user.uid, 'applications'])
  // optimistic local additions to show immediately before Firestore sync
  const [localAdds, setLocalAdds] = useState([])
  const [form, setForm] = useState({ company: '', role: '', source: 'LinkedIn', jobUrl: '', applicationDate: '', reminderAt: '', status: 'Applied' })
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const { schedule } = useNotifications()
  const [settings] = useUserSettings(user)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      if (!form.company || !form.role) return setError('Company and Role are required.')
      // parse applicationDate if provided
      let appDate = null
      if (form.applicationDate) {
        const d = new Date(form.applicationDate)
        if (!isNaN(d)) appDate = d
      }

      // determine reminder: explicit reminderAt > user default > application date
      let reminderDate = null
      if (form.reminderAt) {
        const r = new Date(form.reminderAt)
        if (!isNaN(r)) reminderDate = r
      } else if (settings && settings.defaultTime && appDate) {
        // settings.defaultTime expected as 'HH:MM'
        try {
          const [hh, mm] = settings.defaultTime.split(':').map(x=>parseInt(x,10))
          if (!isNaN(hh) && !isNaN(mm)) {
            const r = new Date(appDate)
            r.setHours(hh, mm, 0, 0)
            reminderDate = r
          }
        } catch(e){}
      }

      const docRef = await addDocument(['users', user.uid, 'applications'], {
        company: form.company,
        role: form.role,
        source: form.source,
        jobUrl: form.jobUrl || '',
        userId: user.uid,
        createdAt: serverTimestamp(),
        status: 'Saved',
        applicationDate: appDate,
        reminderAt: reminderDate
      })
      // optimistic add: show immediately with temporary entry
      try {
        setLocalAdds(prev => [{ id: docRef.id, company: form.company, role: form.role, source: form.source, jobUrl: form.jobUrl || '', userId: user.uid, createdAt: new Date(), applicationDate: appDate, reminderAt: reminderDate, status: 'Saved', optimistic: true }, ...prev])
        // remove optimistic highlight after a short time
        setTimeout(() => setLocalAdds(prev => prev.map(x => x.id === docRef.id ? { ...x, optimistic: false } : x)), 1400)
      } catch(e){ console.warn('optimistic update failed', e) }
        setForm({ company: '', role: '', source: 'LinkedIn', jobUrl: '', applicationDate: '', reminderAt: '' })
      // schedule a browser + in-app notification if reminder datetime provided, else schedule at appDate
      try {
        if (reminderDate) {
          schedule(docRef.id, `Reminder: ${form.company}`, `Follow-up for ${form.role}`, reminderDate)
        } else if (appDate) {
          schedule(docRef.id, `Reminder: ${form.company}`, `Follow-up for ${form.role}`, appDate)
        }
      } catch(e){ console.warn(e) }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to add application')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this application? This action cannot be undone.')) return
    try {
      // optimistically remove from localAdds if present
      setLocalAdds(prev => prev.filter(x => x.id !== id))
      await deleteDocument(['users', user.uid, 'applications'], id)
    } catch (err) {
      console.error(err)
      setError('Failed to delete application')
    }
  }

  const startEdit = (a) => {
    setEditingId(a.id)
    setEditForm({ company: a.company||'', role: a.role||'', source: a.source||'Saved', jobUrl: a.jobUrl||'', applicationDate: a.applicationDate ? (a.applicationDate.toDate ? a.applicationDate.toDate().toISOString().slice(0,10) : new Date(a.applicationDate).toISOString().slice(0,10)) : '', reminderAt: a.reminderAt ? (a.reminderAt.toDate ? a.reminderAt.toDate().toISOString().slice(0,16) : new Date(a.reminderAt).toISOString().slice(0,16)) : '', status: a.status || 'Saved' })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm(null); setError(null) }

  const saveEdit = async (id) => {
    if (!editForm || !editForm.company || !editForm.role) return setError('Company and Role are required.')
    try {
      const appDate = editForm.applicationDate ? new Date(editForm.applicationDate) : null
      const reminder = editForm.reminderAt ? new Date(editForm.reminderAt) : null

      await updateDocument(['users', user.uid, 'applications'], id, {
        company: editForm.company,
        role: editForm.role,
        source: editForm.source,
        jobUrl: editForm.jobUrl || '',
        applicationDate: appDate,
        reminderAt: reminder,
        status: editForm.status,
      })

      try {
        if (reminder && !isNaN(reminder)) {
          schedule(id, `Reminder: ${editForm.company}`, `Follow-up for ${editForm.role}`, reminder)
        } else if (appDate && !isNaN(appDate)) {
          schedule(id, `Reminder: ${editForm.company}`, `Follow-up for ${editForm.role}`, appDate)
        }
      } catch (e) { console.warn('scheduling error', e) }

      setEditingId(null)
      setEditForm(null)
    } catch (err) {
      console.error(err)
      setError('Failed to save changes')
    }
  }

  // cleanup localAdds when Firestore snapshot includes the real doc
  useEffect(() => {
    if (!apps || apps.length === 0) return
    const ids = new Set(apps.map(a => a.id))
    setLocalAdds(prev => prev.filter(x => !ids.has(x.id)))
  }, [apps])

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6 text-gray-900 dark:text-gray-100 fade-in">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Applications</h2>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4 card">
          <input value={form.company} onChange={e=>setForm({...form, company: e.target.value})} placeholder="Company" className="p-2 border rounded" />
          <input value={form.role} onChange={e=>setForm({...form, role: e.target.value})} placeholder="Role" className="p-2 border rounded" />
          <select value={form.source} onChange={e=>setForm({...form, source: e.target.value})} className="p-2 border rounded">
            <option>LinkedIn</option>
            <option>Naukri</option>
            <option>Indeed</option>
            <option>Internshala</option>
            <option>Company Career Page</option>
            <option>Other</option>
          </select>

          <select value={form.status} onChange={e=>setForm({...form, status: e.target.value})} className="p-2 border rounded">
            <option>Applied</option>
            <option>Assessment Pending</option>
            <option>Interview Scheduled</option>
            <option>Offer Received</option>
            <option>Rejected</option>
            <option>Joined</option>
          </select>

          <input value={form.jobUrl} onChange={e=>setForm({...form, jobUrl: e.target.value})} placeholder="Job URL (optional)" className="p-2 border rounded md:col-span-3" />

          <input type="date" value={form.applicationDate} onChange={e=>setForm({...form, applicationDate: e.target.value})} className="p-2 border rounded" />
          <input type="datetime-local" value={form.reminderAt} onChange={e=>setForm({...form, reminderAt: e.target.value})} className="p-2 border rounded" />
          <div className="md:col-span-2 flex items-center">
            <button className="mt-2 px-4 py-2 bg-green-600 text-white rounded">Add Application</button>
          </div>
        </form>

        <div className="space-y-3">
          {[...localAdds, ...apps].map(a => (
            <div key={a.id} className={"card flex justify-between items-center transition transform duration-200 ease-in-out " + (a.optimistic ? 'ring-2 ring-green-200 scale-101 shadow-lg' : 'hover:scale-[1.01] hover:shadow-lg') }>
              <div className="w-3/4">
                {editingId === a.id ? (
                  <div className="space-y-2">
                    <input value={editForm.company} onChange={e=>setEditForm({...editForm, company: e.target.value})} className="w-full p-2 border rounded" />
                    <input value={editForm.role} onChange={e=>setEditForm({...editForm, role: e.target.value})} className="w-full p-2 border rounded" />
                    <input value={editForm.jobUrl} onChange={e=>setEditForm({...editForm, jobUrl: e.target.value})} className="w-full p-2 border rounded" placeholder="Job URL" />
                    <input type="date" value={editForm.applicationDate} onChange={e=>setEditForm({...editForm, applicationDate: e.target.value})} className="p-2 border rounded" />
                    <input type="datetime-local" value={editForm.reminderAt || ''} onChange={e=>setEditForm({...editForm, reminderAt: e.target.value})} className="p-2 border rounded" />
                    <select value={editForm.status} onChange={e=>setEditForm({...editForm, status: e.target.value})} className="p-2 border rounded">
                      <option>Applied</option>
                      <option>Assessment Pending</option>
                      <option>Interview Scheduled</option>
                      <option>Offer Received</option>
                      <option>Rejected</option>
                      <option>Joined</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="font-semibold">{a.company} — {a.role}</div>
                    <div className="text-sm text-gray-500">{a.source} {a.jobUrl ? (<a className="text-blue-600 ml-2" href={a.jobUrl} target="_blank" rel="noopener noreferrer">Open</a>) : null}</div>
                    {a.applicationDate && <div className="text-sm text-gray-500">Applied: {format(a.applicationDate?.toDate ? a.applicationDate.toDate() : new Date(a.applicationDate), 'PPP')}</div>}
                    {a.reminderAt && <div className="text-sm text-gray-500">Reminder: {format(a.reminderAt?.toDate ? a.reminderAt.toDate() : new Date(a.reminderAt), 'PPP p')}</div>}
                    {a.createdAt && <div className="text-xs text-gray-400">Added: {a.createdAt?.toDate ? format(a.createdAt.toDate(), 'PPP p') : ''}</div>}
                    {a.status && <div className="text-xs text-gray-600">Status: {a.status}</div>}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {editingId === a.id ? (
                  <>
                    <button onClick={()=>saveEdit(a.id)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Save</button>
                    <button onClick={cancelEdit} className="px-3 py-1 border rounded text-sm">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>startEdit(a)} className="px-3 py-1 border rounded text-sm">Edit</button>
                    <button onClick={()=>handleDelete(a.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        {error && <div className="mt-3 text-red-600">{error}</div>}
      </div>
    </div>
  )
}
