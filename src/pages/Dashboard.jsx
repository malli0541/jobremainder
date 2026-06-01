import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCollection } from '../hooks/useFirestore'
import { format } from 'date-fns'
import { useApp } from '../contexts/AppContext'
import useUserSettings from '../hooks/useUserSettings'

export default function Dashboard(){
  const { user } = useAuth()
  const applicationsPath = user ? ['users', user.uid, 'applications'] : null
  const apps = useCollection(applicationsPath, null, { orderField: 'appliedAt', orderDirection: 'desc' })
  const recentApps = useCollection(applicationsPath, null, { orderField: 'appliedAt', orderDirection: 'desc', limitCount: 3 })
  const { theme, toggleTheme } = useApp()
  const [settings, saveSettings] = useUserSettings(user)
  const [localTime, setLocalTime] = React.useState(settings?.defaultTime || '')

  React.useEffect(()=>{ setLocalTime(settings?.defaultTime || '') }, [settings])

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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 fade-in">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="px-3 py-1 border rounded text-sm">{theme === 'dark' ? 'Light' : 'Dark'} Mode</button>
            <div className="text-sm">{user?.email}</div>
          </div>
        </div>
      </header>
      <main className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">Total Applications: <span className="font-semibold">{total}</span></div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">Applications This Month: <span className="font-semibold">{thisMonth}</span></div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">Interviews Scheduled: <span className="font-semibold">{interviews}</span></div>
        </div>
        <section className="mt-6 card">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          <div className="mt-3 flex gap-3">
            <Link to="/applications" className="px-4 py-2 bg-blue-600 text-white rounded">Manage Applications</Link>
          </div>
        </section>

        <section className="mt-6 card">
          <h2 className="text-xl font-semibold">Recently Applied</h2>
          <div className="mt-3 space-y-2">
            {recentApps.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-300">No applied jobs yet.</div>
            )}
            {recentApps.map(a => (
              <div key={a.id} className="p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="font-medium text-gray-900 dark:text-gray-100">{a.company} — {a.role}</div>
                <div className="text-sm text-gray-500 dark:text-gray-300">{a.source} {a.jobUrl ? (<a className="text-blue-600 dark:text-blue-400 ml-2" href={a.jobUrl} target="_blank" rel="noreferrer">Open</a>) : null}</div>
                <div className="text-xs text-gray-400 dark:text-gray-400">Applied: {a.applicationDate ? format(a.applicationDate?.toDate ? a.applicationDate.toDate() : new Date(a.applicationDate), 'PPP') : '—'}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 card">
          <h2 className="text-xl font-semibold">Notification Settings</h2>
          <div className="mt-3">
            <label className="block text-sm mb-1">Default reminder time for applications (optional)</label>
            <div className="flex gap-2 items-center">
              <input type="time" value={localTime} onChange={e=>setLocalTime(e.target.value)} className="p-2 border rounded bg-white dark:bg-gray-700 dark:text-gray-100" />
              <button onClick={saveDefaultTime} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Save</button>
            </div>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-300">If set, this time will be used as the reminder time on application dates when no explicit reminder is provided.</div>
          </div>
        </section>
      </main>
    </div>
  )
}
