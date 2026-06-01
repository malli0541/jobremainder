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

export function scheduleApplicationReminder(schedule, application) {
  const reminderDate = getReminderDate(application)
  if (!reminderDate) return false

  return schedule(
    `application-reminder-${application.id}`,
    `Reminder: ${application.company || 'Application'}`,
    `Follow-up for ${application.role || 'this role'}`,
    reminderDate,
    { skipPast: true }
  )
}
