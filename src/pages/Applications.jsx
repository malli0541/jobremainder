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
import NotificationBell from '../components/NotificationBell'
import ThemeToggle from '../components/ThemeToggle'

const statuses = ['Applied', 'Assessment Pending', 'Interview Scheduled', 'Offer Received', 'Rejected', 'Joined']

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
}

const stagger = {
  hidden: {},
  visible: { 
    transition: { 
      staggerChildren: 0.08,
      delayChildren: 0.05
    } 
  }
}

function statusClass(status = 'Applied') {
  if (status.includes('Interview') || status.includes('Assessment')) return 'status-badge status-purple'
  if (status.includes('Offer') || status.includes('Joined')) return 'status-badge status-green'
  if (status.includes('Rejected')) return 'status-badge status-red'
  return 'status-badge status-blue'
}

function ApplicationEditForm({ editForm, setEditForm, onSave, onCancel }) {
  return (
    <div className="apps-edit-form">
      <input value={editForm.company} onChange={e => setEditForm({ ...editForm, company: e.target.value })} placeholder="Company" />
      <input value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} placeholder="Role" />
      <input value={editForm.jobUrl} onChange={e => setEditForm({ ...editForm, jobUrl: e.target.value })} placeholder="Job URL" />
      <input type="date" value={editForm.applicationDate} onChange={e => setEditForm({ ...editForm, applicationDate: e.target.value })} />
      <input type="datetime-local" value={editForm.reminderAt || ''} onChange={e => setEditForm({ ...editForm, reminderAt: e.target.value })} />
      <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
        {statuses.map(status => <option key={status}>{status}</option>)}
      </select>
      <div className="apps-edit-actions">
        <button type="button" onClick={onSave} className="magnetic glow-button px-4 py-2 text-sm">Save</button>
        <button type="button" onClick={onCancel} className="magnetic glass-button px-4 py-2 text-sm">Cancel</button>
      </div>
    </div>
  )
}

function ApplicationCard({ app, editingId, editForm, setEditForm, onEdit, onDelete, onSave, onCancel, formatDate }) {
  const isEditing = editingId === app.id

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`apps-list-card ${app.optimistic ? 'is-new' : ''} ${isEditing ? 'is-editing' : ''}`}
    >
      {isEditing ? (
        <ApplicationEditForm
          editForm={editForm}
          setEditForm={setEditForm}
          onSave={() => onSave(app.id)}
          onCancel={onCancel}
        />
      ) : (
        <>
          <div className="apps-list-card-top">
            <div className="apps-list-card-brand">
              <span className="apps-list-initial" aria-hidden="true">{(app.company || '?').charAt(0).toUpperCase()}</span>
              <div>
                <h3 className="apps-list-company">{app.company}</h3>
                <p className="apps-list-role">{app.role}</p>
              </div>
            </div>
            <span className={statusClass(app.status)}>{app.status || 'Applied'}</span>
          </div>

          <div className="apps-list-meta">
            <span><strong>Source</strong>{app.source || '—'}</span>
            <span><strong>Applied</strong>{formatDate(app.applicationDate, 'MMM d, yyyy')}</span>
          </div>

          <div className="apps-list-actions">
            {app.jobUrl && (
              <a className="magnetic glass-button px-3 py-1.5 text-sm" href={app.jobUrl} target="_blank" rel="noopener noreferrer">Open</a>
            )}
            <button type="button" onClick={() => onEdit(app)} className="magnetic glass-button px-3 py-1.5 text-sm">Edit</button>
            <button type="button" onClick={() => onDelete(app.id)} className="magnetic danger-button px-3 py-1.5 text-sm">Delete</button>
          </div>
        </>
      )}
    </motion.article>
  )
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
  const { schedule, cancel, notifyNow } = useNotifications()
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
    <div className="app-shell apps-page flex-1 px-4 py-6 sm:px-6 lg:px-8 fade-in">
      <div className="dashboard-aurora" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <header className="glass-panel premium-nav mb-6 rounded-3xl">
          <div className="px-4 py-4 sm:px-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-kicker">Pipeline</p>
              <h1 className="app-heading">Manage Applications</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <NotificationBell />
              <ThemeToggle />
              <Link to="/" className="magnetic glass-button px-4 py-2 text-sm">Dashboard</Link>
              <button type="button" onClick={handleLogout} className="hidden md:flex magnetic logout-btn-custom" aria-label="Log out">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <motion.form
          onSubmit={submit}
          className="reveal grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 card glass-hover"
          variants={stagger}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5, ease: "easeOut" }}
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

        <motion.section
          className="apps-list-section dash-section"
          initial="hidden"
          animate="visible"
          variants={stagger}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <motion.div variants={fadeUp} className="apps-list-head">
            <div>
              <p className="section-kicker">Applications</p>
              <h2 className="section-title">Applied list</h2>
              <p className="apps-list-sub">
                {filteredApps.length} shown · {visibleApps.length} total
              </p>
            </div>
            <div className="apps-list-search">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search company, role, source..."
                aria-label="Search applications"
              />
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="apps-filter-bar" role="tablist" aria-label="Filter by status">
            {['All', ...statuses].map(status => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={statusFilter === status}
                className={`apps-filter-chip ${statusFilter === status ? 'is-active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
                {status !== 'All' && (
                  <span className="apps-filter-count">
                    {visibleApps.filter(a => a.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </motion.div>

          {filteredApps.length === 0 ? (
            <div className="apps-list-empty">
              <p>No applications match your filters</p>
              <span>Try a different search term or status filter.</span>
            </div>
          ) : (
            <motion.div layout className="apps-list-grid">
              <AnimatePresence initial={false}>
                {filteredApps.map(a => (
                  <ApplicationCard
                    key={a.id}
                    app={a}
                    editingId={editingId}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onEdit={startEdit}
                    onDelete={handleDelete}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    formatDate={formatDate}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </motion.section>
        {error && <div className="mt-3 text-red-600">{error}</div>}
      </div>
    </div>
  )
}
