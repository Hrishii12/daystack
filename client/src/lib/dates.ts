export const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayStr = () => fmt(new Date())

export function addDays(date: string, n: number) {
  const d = parse(date)
  d.setDate(d.getDate() + n)
  return fmt(d)
}

export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function friendlyDate(s: string) {
  const t = todayStr()
  if (s === t) return 'Today'
  if (s === addDays(t, 1)) return 'Tomorrow'
  if (s === addDays(t, -1)) return 'Yesterday'
  return parse(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export const longDate = (s: string) =>
  parse(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export const time12 = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// Reminder due moment in local time.
export const reminderAt = (date: string, time: string) => {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi)
}

// SQLite datetime('now') values are UTC "YYYY-MM-DD HH:MM:SS".
export const fromDb = (s: string) => new Date(s.replace(' ', 'T') + 'Z')
export const relTime = (s: string) => {
  const diff = Date.now() - fromDb(s).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (min < 1440) return `${Math.round(min / 60)}h ago`
  return fromDb(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
