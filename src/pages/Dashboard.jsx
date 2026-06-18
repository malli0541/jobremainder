import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useCollection } from '../hooks/useFirestore'
import { format } from 'date-fns'
import { useApp } from '../contexts/AppContext'
import useUserSettings from '../hooks/useUserSettings'
import { useNotifications } from '../contexts/NotificationsContext'
import { scheduleApplicationReminder, scheduleSmartJobReminders } from '../utils/reminders'
import NotificationBell from '../components/NotificationBell'

const MotionLink = motion(Link)

function statusClass(status = 'Applied') {
  if (status.includes('Interview') || status.includes('Assessment')) return 'status-badge status-purple'
  if (status.includes('Offer') || status.includes('Joined')) return 'status-badge status-green'
  if (status.includes('Rejected')) return 'status-badge status-red'
  return 'status-badge status-blue'
}

function safeFormatDate(dateValue) {
  try {
    if (!dateValue) return 'N/A'
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return 'N/A'
    return format(date, 'MMM d, yyyy')
  } catch (error) {
    console.error('Date formatting error:', error, dateValue)
    return 'N/A'
  }
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

function AnimatedNumber({ value }) {
  const [display, setDisplay] = React.useState(0)

  React.useEffect(() => {
    let frame
    const start = performance.now()
    const from = display
    const duration = 820

    const tick = (time) => {
      const progress = Math.min((time - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return display
}

export default function Dashboard(){
  const location = useLocation()
  const navigate = useNavigate()
  const heroRef = React.useRef(null)
  const { user, signout } = useAuth()
  const applicationsPath = user ? ['users', user.uid, 'applications'] : null
  const apps = useCollection(applicationsPath, null, { orderField: 'appliedAt', orderDirection: 'desc' })
  const { theme, toggleTheme } = useApp()
  const { schedule, notifyNow, permission } = useNotifications()
  const [settings, saveSettings] = useUserSettings(user)
  const [localTime, setLocalTime] = React.useState(settings?.defaultTime || '')
  const [notificationWindow, setNotificationWindow] = React.useState({
    notificationStartDate: '',
    notificationEndDate: '',
    notificationStartTime: '',
    notificationEndTime: ''
  })

  React.useEffect(()=>{ setLocalTime(settings?.defaultTime || '') }, [settings])
  React.useEffect(() => {
    setNotificationWindow({
      notificationStartDate: settings?.notificationStartDate || '',
      notificationEndDate: settings?.notificationEndDate || '',
      notificationStartTime: settings?.notificationStartTime || '',
      notificationEndTime: settings?.notificationEndTime || ''
    })
  }, [settings])

  React.useEffect(() => {
    apps.forEach(app => scheduleApplicationReminder(schedule, app, settings || {}))
    scheduleSmartJobReminders({ apps, schedule, notifyNow, userId: user?.uid, settings: settings || {} })
  }, [apps, schedule, notifyNow, user?.uid, settings])

  const saveDefaultTime = async () => {
    await saveSettings({
      defaultTime: localTime,
      ...notificationWindow
    })
    notifyNow('Notification settings saved', 'Your reminder date and time window has been updated.', 'notification-settings-saved')
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
  const activeApps = apps.filter(a => !['Rejected', 'Joined'].includes(a.status)).length
  const staleApps = apps.filter(a => {
    const timestamp = a.statusUpdatedAt || a.updatedAt || a.appliedAt || a.createdAt
    if (!timestamp) return false
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return Date.now() - date.getTime() > 7 * 24 * 60 * 60 * 1000
  }).length
  const recentApps = apps.slice(0, 5)
  const statusSummary = [
    { label: 'Active', value: activeApps },
    { label: 'Need update', value: staleApps },
    { label: 'Offers', value: offers }
  ]
  const metricCards = [
    { label: 'Total Applications', value: total, detail: 'All tracked opportunities', tone: 'indigo' },
    { label: 'This Month', value: thisMonth, detail: 'Fresh pipeline activity', tone: 'teal' },
    { label: 'Interviews', value: interviews, detail: 'Conversations in motion', tone: 'violet' },
    { label: 'Offers', value: offers, detail: 'Wins ready to review', tone: 'gold' }
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

  const handleHeroPointerMove = (event) => {
    const panel = heroRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    panel.style.setProperty('--tilt-x', `${(-y * 8).toFixed(2)}deg`)
    panel.style.setProperty('--tilt-y', `${(x * 10).toFixed(2)}deg`)
    panel.style.setProperty('--spot-x', `${(event.clientX - rect.left).toFixed(0)}px`)
    panel.style.setProperty('--spot-y', `${(event.clientY - rect.top).toFixed(0)}px`)
  }

  const resetHeroTilt = () => {
    const panel = heroRef.current
    if (!panel) return
    panel.style.setProperty('--tilt-x', '0deg')
    panel.style.setProperty('--tilt-y', '0deg')
  }

  const handleLogout = async () => {
    await signout()
    navigate('/signin', { replace: true })
  }

  return (
    <div className="premium-shell min-h-screen fade-in">
      <div className="depth-grid" aria-hidden="true" />
      <div className="floating-geometry geometry-one" aria-hidden="true" />
      <div className="floating-geometry geometry-two" aria-hidden="true" />
      <div className="floating-geometry geometry-three" aria-hidden="true" />

      <header className="premium-nav glass-panel">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <Link to="/" className="magnetic flex items-center gap-3">
            <span className="brand-mark">JT</span>
            <span className="font-semibold tracking-wide">Job Remainder</span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-slate-300">
            {[
              { label: 'Overview', href: '#overview', active: location.pathname === '/' },
              { label: 'Applications', to: '/applications', active: location.pathname === '/applications' }
            ].map(item => (
              item.to ? (
                <Link key={item.label} to={item.to} className="nav-morph-item hover:text-white">
                  {item.active && <motion.span layoutId="nav-indicator" className="nav-morph-indicator" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <a key={item.label} href={item.href} className="nav-morph-item hover:text-white">
                  {item.active && <motion.span layoutId="nav-indicator" className="nav-morph-indicator" />}
                  <span>{item.label}</span>
                </a>
              )
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button type="button" onClick={toggleTheme} className="magnetic glass-button px-3 py-2 text-sm">{theme === 'dark' ? 'Light' : 'Dark'} Mode</button>
            <div className="hidden sm:block text-sm text-slate-300">{user?.email}</div>
            <button type="button" onClick={handleLogout} className="magnetic glass-button px-3 py-2 text-sm">Log out</button>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.section
          ref={heroRef}
          className="hero-panel dashboard-hero glass-panel glass-hover"
          onPointerMove={handleHeroPointerMove}
          onPointerLeave={resetHeroTilt}
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="hero-copy max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">Application Command Center</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">Your job search, organized like a premium command deck.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">A focused dashboard for applications, interviews, reminders, and follow-ups, wrapped in a polished glass interface.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/applications" className="magnetic glow-button px-5 py-3 text-center font-semibold">Manage Applications</Link>
              <a href="#settings" className="magnetic glass-button px-5 py-3 text-center font-semibold">Reminder Settings</a>
            </div>
          </motion.div>
          <motion.div variants={fadeUp} className="hero-intel-panel">
            <div className="intel-header">
              <span>Live Pipeline</span>
              <strong>{total}</strong>
            </div>
            <div className="intel-meter" style={{ '--meter': `${Math.min(100, total ? Math.round((activeApps / total) * 100) : 0)}%` }}>
              <span />
            </div>
            <div className="intel-stats">
              {statusSummary.map(item => (
                <div key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="intel-next">
              <span className="status-dot" />
              {staleApps > 0 ? `${staleApps} applications need a status update.` : 'Pipeline is clean. Keep applying consistently.'}
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          id="overview"
          className="dashboard-metrics mt-6"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {metricCards.map(card => (
            <motion.div key={card.label} variants={fadeUp} className={`metric-card premium-metric metric-${card.tone} glass-panel glass-hover`}>
              <div className="metric-topline">
                <span>{card.label}</span>
                <i aria-hidden="true" />
              </div>
              <div className="mt-3 text-4xl font-bold text-white"><AnimatedNumber value={card.value} /></div>
              <p>{card.detail}</p>
              <div className="metric-progress mt-4"><span style={{ width: `${Math.min(100, Math.max(12, card.value * 12))}%` }} /></div>
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
            <div className="chevron-divider"></div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="section-kicker">Activity</p>
                <h2 className="text-xl font-semibold text-white">Recently Applied</h2>
              </div>
              <Link to="/applications" className="magnetic text-sm text-cyan-200 hover:text-white">Open all</Link>
            </div>
            {apps.length === 0 ? (
              <div className="text-sm text-slate-300 py-4">No applied jobs yet.</div>
            ) : (
              <motion.div className="horizontal-scroll-container" variants={stagger}>
                {recentApps.map(a => (
                  <Link
                    key={a.id}
                    to="/applications"
                    className="scroll-card magnetic"
                  >
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="app-card-title">{a.company}</div>
                      <div className="app-muted text-xs">{a.role}</div>
                      <div className="text-xs opacity-70">
                        {safeFormatDate(a.dateApplied || a.createdAt)}
                      </div>
                    </div>
                    <div className="scroll-card-meta flex-shrink-0">
                      <div className={statusClass(a.status)}>{a.status || 'Applied'}</div>
                    </div>
                  </Link>
                ))}
              </motion.div>
            )}
          </motion.div>

          <motion.div variants={fadeUp} className="futuristic-section">
            <div className="futuristic-header">
              <div>
                <span className="futuristic-header section-kicker">Status</span>
                <h2>Applications Status</h2>
              </div>
              <Link to="/applications" className="magnetic text-sm text-cyan-200 hover:text-white">
                View All
              </Link>
            </div>
            
            {apps.length === 0 ? (
              <div className="text-sm text-slate-300 py-4">No applications saved yet.</div>
            ) : (
              <>
                <div className="futuristic-stats">
                  <div className="futuristic-stat">
                    <span>Total:</span>
                    <span className="futuristic-stat-value">{apps.length}</span>
                  </div>
                  <div className="futuristic-stat">
                    <span>This Month:</span>
                    <span className="futuristic-stat-value">{apps.filter(a => {
                      const appDate = new Date(a.dateApplied || a.createdAt);
                      const now = new Date();
                      return appDate.getMonth() === now.getMonth() && appDate.getFullYear() === now.getFullYear();
                    }).length}</span>
                  </div>
                  <div className="futuristic-stat">
                    <span>Active:</span>
                    <span className="futuristic-stat-value">{apps.filter(a => !a.status?.includes('Rejected')).length}</span>
                  </div>
                </div>
                
                <div className="futuristic-scroll-container mt-4">
                  <motion.div className="horizontal-scroll-container" variants={stagger}>
                    {recentApps.map(a => (
                      <Link
                        key={a.id}
                        to="/applications"
                        className="futuristic-card magnetic"
                      >
                        <div className="futuristic-card-content">
                          <div className="futuristic-card-left">
                            <h3 className="futuristic-card-title">{a.company}</h3>
                            <p className="futuristic-card-subtitle">{a.role}</p>
                            <p className="futuristic-card-date">
                              {safeFormatDate(a.dateApplied || a.createdAt)}
                            </p>
                          </div>
                          <div className="futuristic-card-right">
                            <span className="futuristic-stage">{a.status || 'Applied'}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </motion.div>
                  <div className="futuristic-scroll-hint"></div>
                </div>
                
                {apps.length > 5 && (
                  <div className="mt-4 text-sm text-slate-400 text-center">
                    {apps.length - 5} more applications in your tracker
                  </div>
                )}
              </>
            )}
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <input type="time" value={localTime} onChange={e=>setLocalTime(e.target.value)} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
              <label className="block text-sm text-slate-300">
                From date
                <input type="date" value={notificationWindow.notificationStartDate} onChange={e=>setNotificationWindow(prev => ({ ...prev, notificationStartDate: e.target.value }))} className="mt-1 px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
              </label>
              <label className="block text-sm text-slate-300">
                To date
                <input type="date" value={notificationWindow.notificationEndDate} onChange={e=>setNotificationWindow(prev => ({ ...prev, notificationEndDate: e.target.value }))} className="mt-1 px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
              </label>
              <label className="block text-sm text-slate-300">
                From time
                <input type="time" value={notificationWindow.notificationStartTime} onChange={e=>setNotificationWindow(prev => ({ ...prev, notificationStartTime: e.target.value }))} className="mt-1 px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
              </label>
              <label className="block text-sm text-slate-300">
                To time
                <input type="time" value={notificationWindow.notificationEndTime} onChange={e=>setNotificationWindow(prev => ({ ...prev, notificationEndTime: e.target.value }))} className="mt-1 px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent" />
              </label>
              <button onClick={saveDefaultTime} className="magnetic glow-button px-4 py-2 text-sm">Save</button>
            </div>
            <div className="mt-2 text-sm text-slate-300">Browser notification permission: {permission}</div>
            <div className="mt-2 text-sm text-slate-300">Reminders will only fire inside the selected date and time window. If a reminder falls outside the time range, it moves to the next allowed time.</div>
          </div>
        </motion.section>
      </main>
    </div>
  )
}
