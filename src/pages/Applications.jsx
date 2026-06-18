import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useCollection, addDocument, deleteDocument, updateDocument } from '../hooks/useFirestore'
import { serverTimestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { useNotifications } from '../contexts/NotificationsContext'
import useUserSettings from '../hooks/useUserSettings'
import { useApp } from '../contexts/AppContext'
import { applyNotificationWindow, scheduleApplicationReminder, scheduleSmartJobReminders } from '../utils/reminders'
import BellIcon from '../components/BellIcon'

const statuses = ['Applied', 'Assessment Pending', 'Interview Scheduled', 'Offer Received', 'Rejected', 'Joined']

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } }
}

function statusClass(status = 'Applied') {
  if (status.includes('Interview') || status.includes('Assessment')) return 'status-badge status-purple'
  if (status.includes('Offer') || status.includes('Joined')) return 'status-badge status-green'
  if (status.includes('Rejected')) return 'status-badge status-red'
  return 'status-badge status-blue'
}

export default function Applications(){
  const navigate = useNavigate()
  const { user, signout } = useAuth()

  const apps = useCollection(user ? ['users', user.uid, 'applications'] : null)
  // optimistic local additions to show immediately before Firestore sync
  const [localAdds, setLocalAdds] = useState([])
  const [form, setForm] = useState({ company: '', role: '', source: 'LinkedIn', jobUrl: '', applicationDate: '', reminderAt: '', status: 'Applied' })
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const { schedule, cancel, notifyNow, permission, requestPermission } = useNotifications()
  const [settings] = useUserSettings(user)
  const { theme, toggleTheme } = useApp()

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
        appliedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        statusUpdatedAt: serverTimestamp(),
        status: form.status || 'Applied',
        applicationDate: appDate,
        reminderAt: reminderDate
      })
      // optimistic add: show immediately with temporary entry
      try {
        setLocalAdds(prev => [{ id: docRef.id, company: form.company, role: form.role, source: form.source, jobUrl: form.jobUrl || '', userId: user.uid, appliedAt: new Date(), createdAt: new Date(), applicationDate: appDate, reminderAt: reminderDate, status: form.status || 'Applied', optimistic: true }, ...prev])
        // remove optimistic highlight after a short time
        setTimeout(() => setLocalAdds(prev => prev.map(x => x.id === docRef.id ? { ...x, optimistic: false } : x)), 1400)
      } catch(e){ console.warn('optimistic update failed', e) }
        setForm({ company: '', role: '', source: 'LinkedIn', jobUrl: '', applicationDate: '', reminderAt: '', status: 'Applied' })
      // schedule a browser + in-app notification if reminder datetime provided, else schedule at appDate
      try {
        if (reminderDate) {
          const scheduledReminder = applyNotificationWindow(reminderDate, settings || {})
          if (scheduledReminder) schedule(`application-reminder-${docRef.id}`, `Reminder: ${form.company}`, `Follow-up for ${form.role}`, scheduledReminder, { skipPast: true })
        } else if (appDate) {
          const scheduledReminder = applyNotificationWindow(appDate, settings || {})
          if (scheduledReminder) schedule(`application-reminder-${docRef.id}`, `Reminder: ${form.company}`, `Follow-up for ${form.role}`, scheduledReminder, { skipPast: true })
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
      cancel(`application-reminder-${id}`)
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

      const existing = visibleApps.find(app => app.id === id)
      const statusChanged = existing?.status !== editForm.status

      await updateDocument(['users', user.uid, 'applications'], id, {
        company: editForm.company,
        role: editForm.role,
        source: editForm.source,
        jobUrl: editForm.jobUrl || '',
        applicationDate: appDate,
        reminderAt: reminder,
        status: editForm.status,
        updatedAt: serverTimestamp(),
        ...(statusChanged ? { statusUpdatedAt: serverTimestamp() } : {}),
      })

      try {
        if (reminder && !isNaN(reminder)) {
          const scheduledReminder = applyNotificationWindow(reminder, settings || {})
          if (scheduledReminder) schedule(`application-reminder-${id}`, `Reminder: ${editForm.company}`, `Follow-up for ${editForm.role}`, scheduledReminder, { skipPast: true })
        } else if (appDate && !isNaN(appDate)) {
          const scheduledReminder = applyNotificationWindow(appDate, settings || {})
          if (scheduledReminder) schedule(`application-reminder-${id}`, `Reminder: ${editForm.company}`, `Follow-up for ${editForm.role}`, scheduledReminder, { skipPast: true })
        } else {
          cancel(`application-reminder-${id}`)
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

  useEffect(() => {
    apps.forEach(app => scheduleApplicationReminder(schedule, app, settings || {}))
    scheduleSmartJobReminders({ apps, schedule, notifyNow, userId: user?.uid, settings: settings || {} })
  }, [apps, schedule, notifyNow, user?.uid, settings])

  const enableNotifications = async () => {
    const result = await requestPermission()
    if (result === 'granted') {
      notifyNow('Notifications enabled', 'Job Remainder will remind you to apply and update application statuses.', 'notifications-enabled')
    }
  }

  const appIds = new Set(apps.map(a => a.id))
  const visibleApps = [
    ...localAdds.filter(a => !appIds.has(a.id)),
    ...apps
  ]
  const filteredApps = visibleApps.filter(a => {
    const matchesStatus = statusFilter === 'All' || a.status === statusFilter
    const term = search.trim().toLowerCase()
    const matchesSearch = !term || [a.company, a.role, a.source, a.status].some(value => (value || '').toLowerCase().includes(term))
    return matchesStatus && matchesSearch
  })

  const formatDate = (value, pattern = 'PPP') => {
    if (!value) return '-'
    return format(value?.toDate ? value.toDate() : new Date(value), pattern)
  }

  const handleLogout = async () => {
    await signout()
    navigate('/signin', { replace: true })
  }

  if (!user) return <div className="p-6">Please sign in to manage applications.</div>

  return (
    <div className="app-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8 fade-in">
      <div className="floating-sphere sphere-one" aria-hidden="true" />
      <div className="floating-sphere sphere-two" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <header className="glass-panel premium-nav mb-6 rounded-3xl">
          <div className="px-4 py-4 sm:px-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-kicker">Pipeline</p>
              <h1 className="app-heading">Manage Applications</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {permission !== 'granted' && permission !== 'unsupported' && (
                <button
                  type="button"
                  onClick={enableNotifications}
                  className="magnetic glow-button icon-button"
                  aria-label="Enable notifications"
                  title="Enable notifications"
                >
                  <BellIcon />
                </button>
              )}
              {permission === 'granted' && (
                <button
                  type="button"
                  onClick={enableNotifications}
                  className="magnetic glass-button icon-button"
                  aria-label="Notifications enabled"
                  title="Notifications enabled"
                >
                  <BellIcon />
                </button>
              )}
              <button type="button" onClick={toggleTheme} className="magnetic glass-button px-4 py-2 text-sm">{theme === 'dark' ? 'Light' : 'Dark'} Mode</button>
              <Link to="/" className="magnetic glass-button px-4 py-2 text-sm">Dashboard</Link>
              <button type="button" onClick={handleLogout} className="magnetic glass-button px-4 py-2 text-sm">Log out</button>
            </div>
          </div>
        </header>

        <motion.form
          onSubmit={submit}
          className="reveal grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 card glass-hover"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <div className="md:col-span-3">
            <h2 className="section-title">Add Application</h2>
          </div>
          <motion.input variants={fadeUp} value={form.company} onChange={e=>setForm({...form, company: e.target.value})} placeholder="Company" className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
          <motion.input variants={fadeUp} value={form.role} onChange={e=>setForm({...form, role: e.target.value})} placeholder="Role" className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
          <motion.select variants={fadeUp} value={form.source} onChange={e=>setForm({...form, source: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent appearance-none cursor-pointer">
            <option className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">LinkedIn</option>
            <option className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Naukri</option>
            <option className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Indeed</option>
            <option className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Internshala</option>
            <option className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Company Career Page</option>
            <option className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Other</option>
          </motion.select>

          <motion.select variants={fadeUp} value={form.status} onChange={e=>setForm({...form, status: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent appearance-none cursor-pointer">
            {statuses.map(status => <option key={status} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">{status}</option>)}
          </motion.select>

          <motion.input variants={fadeUp} value={form.jobUrl} onChange={e=>setForm({...form, jobUrl: e.target.value})} placeholder="Job URL (optional)" className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent md:col-span-3" />

          <motion.input variants={fadeUp} type="date" value={form.applicationDate} onChange={e=>setForm({...form, applicationDate: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
          <motion.input variants={fadeUp} type="datetime-local" value={form.reminderAt} onChange={e=>setForm({...form, reminderAt: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
          <motion.div variants={fadeUp} className="md:col-span-2 flex items-center">
            <button className="magnetic glow-button mt-2 px-5 py-3 font-semibold">Add Application</button>
          </motion.div>
        </motion.form>

        <motion.section className="reveal card glass-hover" initial="hidden" animate="visible" variants={stagger}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-kicker">Applications</p>
              <h2 className="section-title">Applied List</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(220px,1fr)_180px]">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, role, source..." className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent appearance-none cursor-pointer">
                <option className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">All</option>
                {statuses.map(status => <option key={status} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">{status}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 hidden overflow-hidden rounded-3xl border border-[var(--border)] md:block">
            <table className="glass-table w-full">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Applied</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                {filteredApps.map(a => (
                  <motion.tr key={a.id} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28 }}>
                    {editingId === a.id ? (
                      <td colSpan="6">
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                          <input value={editForm.company} onChange={e=>setEditForm({...editForm, company: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
                          <input value={editForm.role} onChange={e=>setEditForm({...editForm, role: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
                          <input value={editForm.jobUrl} onChange={e=>setEditForm({...editForm, jobUrl: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" placeholder="Job URL" />
                          <input type="date" value={editForm.applicationDate} onChange={e=>setEditForm({...editForm, applicationDate: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
                          <input type="datetime-local" value={editForm.reminderAt || ''} onChange={e=>setEditForm({...editForm, reminderAt: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
                          <select value={editForm.status} onChange={e=>setEditForm({...editForm, status: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent appearance-none cursor-pointer">
                            {statuses.map(status => <option key={status} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">{status}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <button type="button" onClick={()=>saveEdit(a.id)} className="magnetic glow-button px-4 py-2 text-sm">Save</button>
                            <button type="button" onClick={cancelEdit} className="magnetic glass-button px-4 py-2 text-sm">Cancel</button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="font-semibold">{a.company}</td>
                        <td>{a.role}</td>
                        <td>{a.source}</td>
                        <td><span className={statusClass(a.status)}>{a.status || 'Applied'}</span></td>
                        <td>{formatDate(a.applicationDate)}</td>
                        <td>
                          <div className="flex gap-2">
                            {a.jobUrl && <a className="magnetic glass-button px-3 py-1 text-sm" href={a.jobUrl} target="_blank" rel="noopener noreferrer">Open</a>}
                            <button type="button" onClick={()=>startEdit(a)} className="magnetic glass-button px-3 py-1 text-sm">Edit</button>
                            <button type="button" onClick={()=>handleDelete(a.id)} className="magnetic danger-button px-3 py-1 text-sm">Delete</button>
                          </div>
                        </td>
                      </>
                    )}
                  </motion.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="mt-5 space-y-3 md:hidden">
            <AnimatePresence initial={false}>
            {filteredApps.map(a => (
              <motion.div key={a.id} layout initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }} className={"reveal app-card glass-hover " + (a.optimistic ? 'ring-2 ring-amber-300' : '')}>
                {editingId === a.id ? (
                  <div className="space-y-3">
                    <input value={editForm.company} onChange={e=>setEditForm({...editForm, company: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent w-full" />
                    <input value={editForm.role} onChange={e=>setEditForm({...editForm, role: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent w-full" />
                    <input value={editForm.jobUrl} onChange={e=>setEditForm({...editForm, jobUrl: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent w-full" placeholder="Job URL" />
                    <input type="date" value={editForm.applicationDate} onChange={e=>setEditForm({...editForm, applicationDate: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent w-full" />
                    <input type="datetime-local" value={editForm.reminderAt || ''} onChange={e=>setEditForm({...editForm, reminderAt: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent w-full" />
                    <select value={editForm.status} onChange={e=>setEditForm({...editForm, status: e.target.value})} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent appearance-none cursor-pointer w-full">
                      {statuses.map(status => <option key={status} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">{status}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button type="button" onClick={()=>saveEdit(a.id)} className="magnetic glow-button px-4 py-2 text-sm">Save</button>
                      <button type="button" onClick={cancelEdit} className="magnetic glass-button px-4 py-2 text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold app-card-title">{a.company} — {a.role}</div>
                        <div className="text-sm app-muted">{a.source}</div>
                      </div>
                      <span className={statusClass(a.status)}>{a.status || 'Applied'}</span>
                    </div>
                    <div className="mt-3 text-sm app-muted">Applied: {formatDate(a.applicationDate)}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {a.jobUrl && <motion.a whileTap={{ scale: 0.96 }} className="magnetic glass-button px-3 py-2 text-sm" href={a.jobUrl} target="_blank" rel="noopener noreferrer">Open</motion.a>}
                      <button type="button" onClick={()=>startEdit(a)} className="magnetic glass-button px-3 py-2 text-sm">Edit</button>
                      <button type="button" onClick={()=>handleDelete(a.id)} className="magnetic danger-button px-3 py-2 text-sm">Delete</button>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
            </AnimatePresence>
          </div>

          {filteredApps.length === 0 && <div className="empty-state">No applications match your filters.</div>}
        </motion.section>
        {error && <div className="mt-3 text-red-600">{error}</div>}
      </div>
    </div>
  )
}
