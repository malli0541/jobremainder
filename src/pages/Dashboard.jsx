import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useCollection } from '../hooks/useFirestore'
import { format } from 'date-fns'
import { useApp } from '../contexts/AppContext'
import useUserSettings from '../hooks/useUserSettings'
import { useNotifications } from '../contexts/NotificationsContext'
import { scheduleApplicationReminder } from '../utils/reminders'

const MotionLink = motion(Link)

function statusClass(status = 'Applied') {
  if (status.includes('Interview') || status.includes('Assessment')) return 'status-badge status-purple'
  if (status.includes('Offer') || status.includes('Joined')) return 'status-badge status-green'
  if (status.includes('Rejected')) return 'status-badge status-red'
  return 'status-badge status-blue'
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 }
}

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08
    }
  }
}

export default function Dashboard(){
  const { user } = useAuth()
  const applicationsPath = user ? ['users', user.uid, 'applications'] : null
  const apps = useCollection(applicationsPath, null, { orderField: 'appliedAt', orderDirection: 'desc' })
  const { theme, toggleTheme } = useApp()
  const { schedule, permission, requestPermission } = useNotifications()
  const [settings, saveSettings] = useUserSettings(user)
  const [localTime, setLocalTime] = React.useState(settings?.defaultTime || '')

  React.useEffect(()=>{ setLocalTime(settings?.defaultTime || '') }, [settings])

  React.useEffect(() => {
    apps.forEach(app => scheduleApplicationReminder(schedule, app))
  }, [apps, schedule])

  const saveDefaultTime = async () => {
    await saveSettings({ defaultTime: localTime })
  }

  const total = apps.length
  const now = new Date()
  const thisMonth = apps.filter(a => {
    const timestamp = a.appliedAt || a.createdAt
    if (!timestamp) return false
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
  const interviews = apps.filter(a => a.status === 'Interview Scheduled').length
  const offers = apps.filter(a => a.status === 'Offer Received').length
  const metricCards = [
    { label: 'Total Applications', value: total },
    { label: 'This Month', value: thisMonth },
    { label: 'Interviews', value: interviews },
    { label: 'Offers', value: offers }
  ]

  const renderApplicationLink = (a) => {
    const content = (
      <>
        <div className="font-medium app-card-title">{a.company} — {a.role}</div>
        <div className="text-sm app-muted">{a.source}</div>
        <div className="text-xs app-muted">Applied: {a.applicationDate ? format(a.applicationDate?.toDate ? a.applicationDate.toDate() : new Date(a.applicationDate), 'PPP') : '—'}</div>
      </>
    )

    return a.jobUrl ? (
      <motion.a key={a.id} variants={fadeUp} href={a.jobUrl} target="_blank" rel="noreferrer" className="magnetic glass-row block p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        {content}
      </motion.a>
    ) : (
      <MotionLink key={a.id} variants={fadeUp} to="/applications" className="magnetic glass-row block p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        {content}
      </MotionLink>
    )
  }

  return (
    <div className="premium-shell min-h-screen text-white fade-in">
      <div className="depth-grid" aria-hidden="true" />
      <div className="floating-geometry geometry-one" aria-hidden="true" />
      <div className="floating-geometry geometry-two" aria-hidden="true" />
      <div className="floating-geometry geometry-three" aria-hidden="true" />

      <header className="premium-nav glass-panel">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <Link to="/" className="magnetic flex items-center gap-3">
            <span className="brand-mark">JT</span>
            <span className="font-semibold tracking-wide">Job Tracker</span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-slate-300">
            <a href="#overview" className="hover:text-white">Overview</a>
            <Link to="/applications" className="hover:text-white">Applications</Link>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="magnetic glass-button px-3 py-2 text-sm">{theme === 'dark' ? 'Light' : 'Dark'} Mode</button>
            <div className="hidden sm:block text-sm text-slate-300">{user?.email}</div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.section
          className="hero-panel glass-panel glass-hover"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">Application Command Center</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">Track every opportunity with calm, futuristic clarity.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">A focused dashboard for applications, interviews, reminders, and follow-ups, wrapped in a polished glass interface.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/applications" className="magnetic glow-button px-5 py-3 text-center font-semibold">Manage Applications</Link>
            </div>
          </motion.div>
          <motion.div variants={fadeUp} className="hero-orbit" aria-hidden="true">
            <div className="orbit-card orbit-card-one">Applied</div>
            <div className="orbit-card orbit-card-two">Interview</div>
            <div className="orbit-card orbit-card-three">Offer</div>
          </motion.div>
        </motion.section>

        <motion.section
          id="overview"
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {metricCards.map(card => (
            <motion.div key={card.label} variants={fadeUp} className="metric-card glass-panel glass-hover">
              <div className="text-sm text-slate-300">{card.label}</div>
              <div className="mt-3 text-4xl font-bold text-white">{card.value}</div>
            </motion.div>
          ))}
        </motion.section>

        <motion.section
          id="applications"
          className="mt-6 dashboard-grid"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.16 }}
        >
          <motion.div variants={fadeUp} className="content-panel glass-panel glass-hover">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Recently Applied</h2>
              <Link to="/applications" className="magnetic text-sm text-cyan-200 hover:text-white">Open all</Link>
            </div>
            <motion.div className="mt-4 space-y-3" variants={stagger}>
            {apps.length === 0 && (
              <div className="text-sm text-slate-300">No applied jobs yet.</div>
            )}
            {apps.map(renderApplicationLink)}
            </motion.div>
          </motion.div>

          <motion.div variants={fadeUp} className="content-panel glass-panel glass-hover">
            <h2 className="text-xl font-semibold text-white">Applications Applied</h2>
            <div className="mt-4 space-y-3">
            {apps.length === 0 && (
              <div className="text-sm text-slate-300">No applications saved yet.</div>
            )}
            {apps.map(a => (
              <Link key={a.id} to="/applications" className="magnetic glass-row block p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium app-card-title">{a.company} — {a.role}</div>
                    <div className="text-sm app-muted">{a.source}</div>
                  </div>
                  <div className={statusClass(a.status)}>{a.status || 'Applied'}</div>
                </div>
              </Link>
            ))}
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          id="settings"
          className="mt-6 content-panel glass-panel glass-hover"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <h2 className="text-xl font-semibold text-white">Notification Settings</h2>
          <div className="mt-3">
            <label className="block text-sm mb-1 text-slate-300">Default reminder time for applications (optional)</label>
            <div className="flex gap-2 items-center">
              <input type="time" value={localTime} onChange={e=>setLocalTime(e.target.value)} className="p-2 border rounded bg-white dark:bg-gray-700 dark:text-gray-100" />
              <button onClick={saveDefaultTime} className="magnetic glow-button px-4 py-2 text-sm">Save</button>
              {permission !== 'granted' && permission !== 'unsupported' && (
                <button type="button" onClick={requestPermission} className="magnetic glass-button px-4 py-2 text-sm">Enable Notifications</button>
              )}
            </div>
            <div className="mt-2 text-sm text-slate-300">Browser notification permission: {permission}</div>
            <div className="mt-2 text-sm text-slate-300">If set, this time will be used as the reminder time on application dates when no explicit reminder is provided.</div>
          </div>
        </motion.section>
      </main>
    </div>
  )
}
