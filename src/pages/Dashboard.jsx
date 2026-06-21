import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useCollection } from '../hooks/useFirestore'
import { format } from 'date-fns'
import { useApp } from '../contexts/AppContext'
import useUserSettings from '../hooks/useUserSettings'
import { useNotifications } from '../contexts/NotificationsContext'
import { scheduleApplicationReminder, scheduleSmartJobReminders } from '../utils/reminders'
import NotificationBell from '../components/NotificationBell'
import ThemeToggle from '../components/ThemeToggle'

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
      staggerChildren: 0.1,
      delayChildren: 0.1
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

const STATUS_COLORS = {
  Applied: '#64748B',
  'Assessment Pending': '#94A3B8',
  'Interview Scheduled': '#CBD5E1',
  'Offer Received': '#34d399',
  Rejected: '#f87171',
  Joined: '#2dd4bf'
}

function StatusOrbit({ statusBreakdown, total }) {
  const circumference = 2 * Math.PI * 54
  let offset = 0

  return (
    <div className="status-orbit-wrap">
      <div className="status-orbit-ring" aria-hidden="true">
        <svg viewBox="0 0 128 128" className="status-orbit-svg">
          <circle cx="64" cy="64" r="54" className="status-orbit-track" />
          {statusBreakdown.map(item => {
            const fraction = total ? item.count / total : 0
            const dash = fraction * circumference
            const segment = (
              <circle
                key={item.status}
                cx="64"
                cy="64"
                r="54"
                className="status-orbit-segment"
                stroke={STATUS_COLORS[item.status] || '#64748B'}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return segment
          })}
        </svg>
        <div className="status-orbit-core">
          <strong>{total}</strong>
          <span>Tracked</span>
        </div>
      </div>
      <ul className="status-orbit-legend" role="list">
        {statusBreakdown.map(item => (
          <motion.li
            key={item.status}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
          >
            <a href="#applications-page" className="status-orbit-legend-row magnetic">
              <span className="status-orbit-dot" style={{ '--dot-color': STATUS_COLORS[item.status] || '#64748B' }} />
              <span className={statusClass(item.status)}>{item.status}</span>
              <span className="status-orbit-bar" aria-hidden="true">
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((item.count / Math.max(1, total)) * 100)}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span className="status-orbit-count"><AnimatedNumber value={item.count} /></span>
            </a>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

function LoopMarquee({ items, renderItem, ariaLabel }) {
  const trackRef = React.useRef(null)
  const [duration, setDuration] = React.useState(32)
  const doubled = items.length ? [...items, ...items] : []

  React.useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const half = track.scrollWidth / 2
    setDuration(Math.max(18, Math.round(half / 42)))
  }, [items])

  if (!items.length) return null

  return (
    <div className="loop-marquee" aria-label={ariaLabel}>
      <div className="loop-marquee-fade loop-marquee-fade-left" aria-hidden="true" />
      <div className="loop-marquee-fade loop-marquee-fade-right" aria-hidden="true" />
      <div
        ref={trackRef}
        className="loop-marquee-track"
        style={{ '--loop-duration': `${duration}s` }}
      >
        {doubled.map((item, index) => (
          <div key={`${item.id}-${index}`} className="loop-marquee-item">
            {renderItem(item, index % items.length)}
          </div>
        ))}
      </div>
    </div>
  )
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
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

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
  const recentApps = apps.slice(0, 6)
  const statusSummary = [
    { label: 'Active', value: activeApps },
    { label: 'Need update', value: staleApps },
    { label: 'Offers', value: offers }
  ]

  const statusOrder = ['Applied', 'Assessment Pending', 'Interview Scheduled', 'Offer Received', 'Rejected', 'Joined']
  const statusBreakdown = statusOrder
    .map(status => ({
      status,
      count: apps.filter(a => (a.status || 'Applied') === status).length
    }))
    .filter(item => item.count > 0)

  const metricCards = [
    { label: 'Total Applications', value: total, detail: 'All tracked opportunities', tone: 'indigo' },
    { label: 'This Month', value: thisMonth, detail: 'Fresh pipeline activity', tone: 'teal' },
    { label: 'Interviews', value: interviews, detail: 'Conversations in motion', tone: 'violet' },
    { label: 'Offers', value: offers, detail: 'Wins ready to review', tone: 'gold' }
  ]

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

  const displayName = user?.email?.split('@')[0]?.replace(/[._]/g, ' ') || 'there'
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const pipelineHealth = total ? Math.round((activeApps / total) * 100) : 0
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const openSettings = () => {
    setSettingsOpen(true)
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      }, 100)
    })
  }

  return (
    <div className="premium-shell dashboard-page flex flex-1 flex-col min-h-0 fade-in">
      <div className="depth-grid" aria-hidden="true" />
      <div className="dashboard-aurora" aria-hidden="true" />

      <header className="premium-nav glass-panel relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <Link to="/" className="magnetic flex items-center gap-3">
            <span className="brand-mark">JT</span>
            <span className="font-semibold tracking-wide hidden sm:inline-block">Job Tracker</span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-slate-600 dark:text-slate-300">
            <a href="#overview" className="nav-morph-item hover:text-slate-900 dark:hover:text-white">
              <span>Overview</span>
            </a>
            <Link to="/applications" className="nav-morph-item hover:text-slate-900 dark:hover:text-white">
              <span>Applications</span>
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            <div className="hidden sm:block text-sm text-slate-300">{user?.email}</div>
            <button type="button" onClick={handleLogout} className="hidden md:flex magnetic logout-btn-custom" aria-label="Log out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
            <button 
              type="button" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden magnetic p-1.5 rounded-lg border border-slate-300/30 dark:border-slate-700/50 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors hamburger-btn-custom"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden w-full overflow-hidden border-b border-t border-[color:var(--border)] shadow-2xl absolute top-16 left-0 right-0 z-50"
              style={{ background: 'var(--surface)', backdropFilter: 'blur(24px)' }}
            >
              <nav className="flex flex-col px-6 py-4 gap-3 text-sm text-slate-600 dark:text-slate-300">
                <a 
                  href="#overview" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 hover:text-slate-900 dark:hover:text-white transition-colors border-b border-slate-200/50 dark:border-slate-800/40 flex items-center justify-between"
                >
                  <span>Overview</span>
                  <span className="opacity-40 text-xs">→</span>
                </a>
                <Link 
                  to="/applications" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-between"
                >
                  <span>Applications</span>
                  <span className="opacity-40 text-xs">→</span>
                </Link>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="dashboard-main relative z-10 flex flex-1 flex-col gap-6 px-4 pt-6 pb-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <motion.section
          ref={heroRef}
          className="dash-hero glass-panel"
          onPointerMove={handleHeroPointerMove}
          onPointerLeave={resetHeroTilt}
          initial="hidden"
          animate="visible"
          variants={stagger}
          transition={{ duration: 0.5, ease: "easeOut", staggerChildren: 0.1 }}
        >
          <motion.div variants={fadeUp} className="dash-hero-copy">
            <p className="dash-eyebrow">{greeting}, {displayName}</p>
            <h1 className="dash-title">Your job search command center</h1>
            <p className="dash-lead">
              {total > 0
                ? `${total} application${total === 1 ? '' : 's'} tracked · ${activeApps} active in pipeline`
                : 'Start tracking applications, interviews, and follow-ups in one place.'}
            </p>
            <div className="dash-hero-actions">
              <Link to="/applications" className="magnetic glow-button px-5 py-2.5 font-semibold">Manage Applications</Link>
              <button type="button" onClick={openSettings} className="magnetic glass-button px-5 py-2.5 font-semibold">Reminders</button>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="dash-hero-panel">
            <div className="dash-hero-panel-top">
              <span>Pipeline health</span>
              <strong>{pipelineHealth}%</strong>
            </div>
            <div className="dash-health-bar" style={{ '--health': `${pipelineHealth}%` }}>
              <span />
            </div>
            <div className="dash-hero-stats">
              {statusSummary.map(item => (
                <div key={item.label} className="dash-hero-stat">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <p className="dash-hero-note">
              <span className="status-dot" />
              {staleApps > 0 ? `${staleApps} need a status update` : 'Pipeline is up to date'}
            </p>
          </motion.div>
        </motion.section>

        <motion.section
          id="overview"
          className="dash-metrics"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05, margin: "0px 0px -50px 0px" }}
          transition={{ duration: 0.5, ease: "easeOut", staggerChildren: 0.08 }}
        >
          {metricCards.map(card => (
            <motion.div key={card.label} variants={fadeUp} className={`dash-metric metric-${card.tone}`}>
              <div className="dash-metric-head">
                <span>{card.label}</span>
                <i aria-hidden="true" />
              </div>
              <div className="dash-metric-value"><AnimatedNumber value={card.value} /></div>
              <p>{card.detail}</p>
            </motion.div>
          ))}
        </motion.section>

        <motion.section
          id="applications"
          className="dash-section dash-pipeline"
          aria-labelledby="applications-hub-heading"
          variants={stagger}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.6, ease: "easeOut", staggerChildren: 0.1 }}
        >
          <motion.div variants={fadeUp} className="dash-section-head">
            <div>
              <p className="section-kicker">Live pipeline</p>
              <h2 id="applications-hub-heading" className="section-title">Applications overview</h2>
            </div>
            <div className="dash-section-badges">
              <span className="dash-pill">Active <strong><AnimatedNumber value={activeApps} /></strong></span>
              <span className="dash-pill">Total <strong><AnimatedNumber value={total} /></strong></span>
              <Link to="/applications" className="magnetic glow-button px-4 py-2 text-sm font-semibold">View all</Link>
            </div>
          </motion.div>

          {apps.length === 0 ? (
            <div className="dash-empty">
              <p>No applications yet</p>
              <span>Add your first role to unlock live status tracking and the recent-applications loop.</span>
              <Link to="/applications" className="magnetic glow-button px-4 py-2 text-sm font-semibold">Add application</Link>
            </div>
          ) : (
            <div className="dash-pipeline-grid">
              <motion.div variants={fadeUp} className="dash-panel" aria-labelledby="status-breakdown-heading">
                <div className="dash-panel-head">
                  <h3 id="status-breakdown-heading">Applications status</h3>
                  <span className="dash-live"><span className="status-dot" />Live</span>
                </div>
                <StatusOrbit statusBreakdown={statusBreakdown} total={total} />
              </motion.div>

              <motion.div variants={fadeUp} className="dash-panel" aria-labelledby="recent-apps-heading">
                <div className="dash-panel-head">
                  <h3 id="recent-apps-heading">Recently applied</h3>
                  {apps.length > recentApps.length && (
                    <span className="dash-panel-meta">+{apps.length - recentApps.length} more</span>
                  )}
                </div>
                <LoopMarquee
                  items={recentApps}
                  ariaLabel="Recently applied jobs scrolling loop"
                  renderItem={(a) => (
                    <Link
                      to="/applications"
                      className="dash-loop-card magnetic"
                      aria-label={`${a.company}, ${a.role}, ${a.status || 'Applied'}, applied ${safeFormatDate(a.dateApplied || a.createdAt)}`}
                    >
                      <div className="dash-loop-card-body">
                        <p className="dash-loop-company">{a.company}</p>
                        <p className="dash-loop-role">{a.role}</p>
                        <p className="dash-loop-date">{safeFormatDate(a.dateApplied || a.createdAt)}</p>
                      </div>
                      <span className={statusClass(a.status)}>{a.status || 'Applied'}</span>
                    </Link>
                  )}
                />
              </motion.div>
            </div>
          )}
        </motion.section>

        <motion.section
          id="settings"
          className={`dash-section dash-settings ${settingsOpen ? 'is-open' : ''}`}
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05, margin: "0px 0px -50px 0px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <button
            type="button"
            className="dash-settings-toggle"
            onClick={() => setSettingsOpen(open => !open)}
            aria-expanded={settingsOpen}
          >
            <div>
              <p className="section-kicker">Alerts</p>
              <h2 className="section-title">Notification settings</h2>
            </div>
            <span className="dash-settings-chevron" aria-hidden="true" />
          </button>

          <div className="dash-settings-body">
            <p className="dash-settings-lead">Set your default reminder time and the window when notifications are allowed.</p>
            <div className="dash-form-grid">
              <label className="dash-field">
                <span>Default reminder time</span>
                <input type="time" value={localTime} onChange={e => setLocalTime(e.target.value)} />
              </label>
              <label className="dash-field">
                <span>From date</span>
                <input type="date" value={notificationWindow.notificationStartDate} onChange={e => setNotificationWindow(prev => ({ ...prev, notificationStartDate: e.target.value }))} />
              </label>
              <label className="dash-field">
                <span>To date</span>
                <input type="date" value={notificationWindow.notificationEndDate} onChange={e => setNotificationWindow(prev => ({ ...prev, notificationEndDate: e.target.value }))} />
              </label>
              <label className="dash-field">
                <span>From time</span>
                <input type="time" value={notificationWindow.notificationStartTime} onChange={e => setNotificationWindow(prev => ({ ...prev, notificationStartTime: e.target.value }))} />
              </label>
              <label className="dash-field">
                <span>To time</span>
                <input type="time" value={notificationWindow.notificationEndTime} onChange={e => setNotificationWindow(prev => ({ ...prev, notificationEndTime: e.target.value }))} />
              </label>
              <div className="dash-field dash-field-action">
                <button type="button" onClick={saveDefaultTime} className="magnetic glow-button px-4 py-2 text-sm w-full sm:w-auto">Save settings</button>
              </div>
            </div>
            <div className="dash-settings-foot">
              <p>Browser permission: <strong>{permission}</strong></p>
              <p>Reminders only fire inside your selected date and time window.</p>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  )
}
