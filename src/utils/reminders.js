export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (value.toDate) return value.toDate()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getReminderDate(application) {
  return toDate(application?.reminderAt)
}

function parseDateBoundary(value, endOfDay = false) {
  if (!value) return null
  const date = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseTime(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

export function applyNotificationWindow(date, settings = {}) {
  if (!date || Number.isNaN(date.getTime())) return null

  const startDate = parseDateBoundary(settings.notificationStartDate)
  const endDate = parseDateBoundary(settings.notificationEndDate, true)
  if (startDate && date < startDate) date = new Date(startDate)
  if (endDate && date > endDate) return null

  const startTime = parseTime(settings.notificationStartTime)
  const endTime = parseTime(settings.notificationEndTime)
  if (!startTime && !endTime) return date

  const candidate = new Date(date)
  const dayStart = new Date(candidate)
  const dayEnd = new Date(candidate)

  if (startTime) dayStart.setHours(startTime.hours, startTime.minutes, 0, 0)
  else dayStart.setHours(0, 0, 0, 0)

  if (endTime) dayEnd.setHours(endTime.hours, endTime.minutes, 59, 999)
  else dayEnd.setHours(23, 59, 59, 999)

  if (dayEnd < dayStart) {
    dayEnd.setDate(dayEnd.getDate() + 1)
  }

  if (candidate < dayStart) candidate.setTime(dayStart.getTime())
  if (candidate > dayEnd) {
    candidate.setDate(candidate.getDate() + 1)
    candidate.setHours(dayStart.getHours(), dayStart.getMinutes(), 0, 0)
  }

  if (endDate && candidate > endDate) return null
  return candidate
}

export function isInsideNotificationWindow(date, settings = {}) {
  const adjusted = applyNotificationWindow(new Date(date), settings)
  return Boolean(adjusted && adjusted.getTime() === date.getTime())
}

export function scheduleApplicationReminder(schedule, application, settings = {}) {
  const reminderDate = getReminderDate(application)
  if (!reminderDate) return false
  const scheduledDate = applyNotificationWindow(reminderDate, settings)
  if (!scheduledDate) return false

  return schedule(
    `application-reminder-${application.id}`,
    `Reminder: ${application.company || 'Application'}`,
    `Follow-up for ${application.role || 'this role'}`,
    scheduledDate,
    { skipPast: true }
  )
}

function latestDate(values) {
  return values
    .map(toDate)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null
}

function notifyOncePerDay(key, notifyNow, title, body) {
  if (!notifyNow || typeof localStorage === 'undefined') return false
  const today = new Date().toISOString().slice(0, 10)
  const storageKey = `jr_notification_${key}_${today}`
  if (localStorage.getItem(storageKey)) return false
  localStorage.setItem(storageKey, '1')
  notifyNow(title, body, key)
  return true
}

export function scheduleSmartJobReminders({ apps = [], schedule, notifyNow, userId = 'user', settings = {} }) {
  const now = new Date()
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  const lastApplicationDate = latestDate(apps.map(app => app.applicationDate || app.appliedAt || app.createdAt))
  const noApplicationReminderAt = applyNotificationWindow(lastApplicationDate
    ? new Date(lastApplicationDate.getTime() + twoDaysMs)
    : new Date(now.getTime() + 60 * 60 * 1000), settings)

  if (schedule && noApplicationReminderAt) {
    schedule(
      `job-activity-reminder-${userId}`,
      'Job Remainder',
      "You haven't added any applications for 2 days. Check new roles and keep your pipeline moving.",
      noApplicationReminderAt,
      { skipPast: true }
    )
  }

  if (lastApplicationDate && now.getTime() - lastApplicationDate.getTime() >= twoDaysMs && isInsideNotificationWindow(now, settings)) {
    notifyOncePerDay(
      `job-activity-reminder-${userId}`,
      notifyNow,
      'Job Remainder',
      "You haven't added any applications for 2 days. Add new jobs or review saved roles today."
    )
  }

  apps.forEach((app) => {
    if (!app?.id) return
    const lastStatusDate = latestDate([app.statusUpdatedAt, app.updatedAt, app.appliedAt, app.createdAt, app.applicationDate])
    if (!lastStatusDate) return

    const statusReminderAt = applyNotificationWindow(new Date(lastStatusDate.getTime() + sevenDaysMs), settings)
    if (schedule && statusReminderAt) {
      schedule(
        `status-update-reminder-${app.id}`,
        `Update ${app.company || 'application'} status`,
        `It has been 7 days since this application status was updated. Please check ${app.role || 'this role'}.`,
        statusReminderAt,
        { skipPast: true }
      )
    }

    if (now.getTime() - lastStatusDate.getTime() >= sevenDaysMs && isInsideNotificationWindow(now, settings)) {
      notifyOncePerDay(
        `status-update-reminder-${app.id}`,
        notifyNow,
        `Update ${app.company || 'application'} status`,
        `This application has not been updated for 7 days. Please update the status.`
      )
    }
  })
}
