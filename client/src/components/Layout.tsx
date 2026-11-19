import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Bell, BellRing, CalendarCheck, CheckSquare, LayoutDashboard, Layers, Plus, StickyNote, Ticket, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormDialog } from '@/components/common'
import { api, type Reminder } from '@/lib/api'
import { fmt, reminderAt, time12, todayStr } from '@/lib/dates'
import { mutate, useApi } from '@/lib/useApi'

const NAV = [
  { to: '/', label: 'My Day', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/jira', label: 'Jira Tracker', icon: Ticket },
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/summary', label: 'Daily Summary', icon: CalendarCheck },
]

const Ctx = createContext<{ quickAdd: () => void }>({ quickAdd: () => {} })
export const useApp = () => useContext(Ctx)

const NOTIFIED_KEY = 'daystack:notified'
const readNotified = (): string[] => {
  try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]') } catch { return [] }
}

/** Polls reminders; fires in-app toast + browser notification when one becomes due. */
function useReminderAlerts() {
  const { data } = useApi<Reminder[]>('/reminders')
  const ref = useRef<Reminder[]>([])
  ref.current = data ?? []

  useEffect(() => {
    const check = () => {
      const seen = readNotified()
      const now = Date.now()
      for (const r of ref.current) {
        const key = `${r.id}@${r.remind_date}T${r.remind_time}`
        // Only alert for reminders that came due within the last day and haven't fired yet.
        const at = reminderAt(r.remind_date, r.remind_time).getTime()
        if (r.completed || at > now || now - at > 864e5 || seen.includes(key)) continue
        seen.push(key)
        toast(r.title, {
          description: `Reminder · ${time12(r.remind_time)}`,
          icon: <BellRing className="size-4 text-indigo-600" />,
          duration: 12000,
          action: { label: 'Done', onClick: () => mutate(() => api.put(`/reminders/${r.id}`, { completed: true }), 'Reminder completed') },
        })
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('DayStack reminder', { body: r.title })
        }
      }
      try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(seen.slice(-200))) } catch { /* ignore */ }
    }
    check()
    const id = setInterval(check, 15000)
    return () => clearInterval(id)
  }, [data])
}

function NotificationToggle() {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied')
  if (!supported) return null
  if (perm === 'granted') {
    return <p className="flex items-center gap-2 px-3 text-xs text-muted-foreground"><BellRing className="size-3.5 text-emerald-600" />Browser alerts on</p>
  }
  return (
    <Button variant="outline" size="sm" className="mx-1 justify-start" disabled={perm === 'denied'}
      onClick={async () => {
        const p = await Notification.requestPermission()
        setPerm(p)
        if (p === 'granted') toast.success('Browser notifications enabled')
      }}>
      <BellRing /> {perm === 'denied' ? 'Alerts blocked in browser' : 'Enable browser alerts'}
    </Button>
  )
}

type QuickKind = 'task' | 'note' | 'reminder'
function QuickAddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [kind, setKind] = useState<QuickKind>('task')
  const [text, setText] = useState('')
  useEffect(() => { if (open) setText('') }, [open])

  const submit = async () => {
    if (!text.trim()) { toast.error('Type something first'); return false }
    if (kind === 'task') return mutate(() => api.post('/tasks', { title: text, due_date: todayStr() }), 'Task added for today')
    if (kind === 'note') return mutate(() => api.post('/notes', { content: text, kind: 'quick' }), 'Quick note saved')
    const d = new Date(Date.now() + 3600e3)
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0')
    const date = fmt(d)
    return mutate(() => api.post('/reminders', { title: text, remind_date: date, remind_time: `${hh}:${mm}` }), 'Reminder set for 1 hour from now')
  }
  const kinds: { k: QuickKind; label: string; icon: typeof Zap }[] = [
    { k: 'task', label: 'Task', icon: CheckSquare }, { k: 'note', label: 'Quick note', icon: StickyNote }, { k: 'reminder', label: 'Reminder', icon: Bell },
  ]
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Quick add" description="Capture it now, organize later." submitLabel="Add" onSubmit={submit}>
      <div className="grid grid-cols-3 gap-2">
        {kinds.map(({ k, label, icon: Icon }) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={cn('flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm transition-colors',
              kind === k ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-700' : 'text-muted-foreground hover:bg-muted')}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>
      <Input autoFocus value={text} onChange={(e) => setText(e.target.value)}
        placeholder={kind === 'task' ? 'What needs doing today?' : kind === 'note' ? 'Testing observation, follow-up…' : 'Remind me in 1 hour to…'} />
    </FormDialog>
  )
}

export default function Layout() {
  const [quick, setQuick] = useState(false)
  useReminderAlerts()

  // Global shortcut: press "q" outside inputs.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === 'q' && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); setQuick(true) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <Ctx.Provider value={{ quickAdd: () => setQuick(true) }}>
      <div className="min-h-screen bg-background">
        {/* Desktop / tablet sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar p-4 md:flex">
          <div className="mb-6 flex items-center gap-2.5 px-2 pt-1">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm"><Layers className="size-5" /></div>
            <div>
              <p className="text-[15px] font-semibold leading-none tracking-tight">DayStack</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Daily work tracker</p>
            </div>
          </div>
          <Button className="mb-4 w-full bg-indigo-600 text-white hover:bg-indigo-700" size="lg" onClick={() => setQuick(true)}>
            <Plus /> Quick add <kbd className="ml-auto rounded bg-white/20 px-1.5 text-[10px]">Q</kbd>
          </Button>
          <nav className="flex flex-1 flex-col gap-0.5">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                <Icon className="size-[18px]" />{label}
              </NavLink>
            ))}
          </nav>
          <NotificationToggle />
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white"><Layers className="size-4" /></div>
            <span className="font-semibold tracking-tight">DayStack</span>
          </div>
          <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setQuick(true)}><Plus /> Add</Button>
        </header>

        <main className="px-4 pb-24 pt-6 md:ml-60 md:px-8 md:pb-10 md:pt-8">
          <div className="mx-auto max-w-5xl"><Outlet /></div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-background/95 backdrop-blur md:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[10px]', isActive ? 'text-indigo-600' : 'text-muted-foreground')}>
              <Icon className="size-5" />{label.split(' ')[0]}
            </NavLink>
          ))}
        </nav>
      </div>
      <QuickAddDialog open={quick} onOpenChange={setQuick} />
    </Ctx.Provider>
  )
}
