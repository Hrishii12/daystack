import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCircle2, CircleDashed, ListTodo, Loader, Plus, Sparkles, StickyNote as StickyNoteIcon, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NoteDialog } from '@/components/forms'
import { Checkbox } from '@/components/ui/checkbox'
import StickyNote, { toggleNote } from '@/components/StickyNote'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { ConfirmDialog, EmptyState, ErrorState, ListSkeleton, StatusBadge } from '@/components/common'
import { TaskDialog } from '@/components/forms'
import TaskRow from '@/components/TaskRow'
import { useApp } from '@/components/Layout'
import { api, type Note, type Reminder, type Task, type Ticket } from '@/lib/api'
import { fmt, friendlyDate, greeting, longDate, reminderAt, time12, todayStr } from '@/lib/dates'
import { mutate, useApi } from '@/lib/useApi'
import { cn } from '@/lib/utils'

const GROUPS = [
  { status: 'In Progress', dot: 'bg-blue-500' },
  { status: 'Blocked', dot: 'bg-rose-500' },
  { status: 'Not Started', dot: 'bg-slate-400' },
]
const PRIO ={ High: 0, Medium: 1, Low: 2 }

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof ListTodo; tone: string }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
        </div>
        <div className={cn('flex size-10 items-center justify-center rounded-xl', tone)}><Icon className="size-5" /></div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { quickAdd } = useApp()
  const tasksQ = useApi<Task[]>('/tasks')
  const remindersQ = useApi<Reminder[]>('/reminders?completed=false')
  const ticketsQ = useApi<Ticket[]>('/tickets?on_plate=true')
  const [editing, setEditing] = useState<Task | null>(null)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const notesQ = useApi<Note[]>('/notes')
  const [quick, setQuick] = useState('')
  const [noteEditing, setNoteEditing] = useState<Note | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDeleting, setNoteDeleting] = useState<Note | null>(null)
  const today = todayStr()
  const doneToday = (iso: string | null) => !!iso && fmt(new Date(iso)) === today
  const stickies = (notesQ.data ?? []).filter((n) => !n.completed).slice(0, 6)
  const doneNotes = (notesQ.data ?? []).filter((n) => n.completed && doneToday(n.completed_at))

  const { mine, stats } = useMemo(() => {
    // "My Day" = due today + unfinished tasks from earlier days + anything finished today.
    const mine = (tasksQ.data ?? [])
      .filter((t) => t.due_date === today || (t.due_date < today && t.status !== 'Done') || (t.status === 'Done' && doneToday(t.completed_at)))
      .sort((a, b) => Number(a.status === 'Done') - Number(b.status === 'Done') || PRIO[a.priority] - PRIO[b.priority])
    return {
      mine,
      stats: {
        total: mine.length,
        progress: mine.filter((t) => t.status === 'In Progress').length,
        done: mine.filter((t) => t.status === 'Done').length,
        blocked: mine.filter((t) => t.status === 'Blocked').length,
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksQ.data, today])
  const doneTasks = mine.filter((t) => t.status === 'Done')
  const openCount = mine.length - doneTasks.length

  const reminders = (remindersQ.data ?? []).slice(0, 5)
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{longDate(today)}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{greeting()} <span className="inline-block">👋</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.total === 0 ? 'Nothing planned yet. Add your first task.' : `${stats.total - stats.done} left on your plate today · ${pct}% done`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={quickAdd}><Zap /> Quick add</Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setEditing(null); setOpen(true) }}><Plus /> New task</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total tasks" value={stats.total} icon={ListTodo} tone="bg-slate-100 text-slate-600" />
        <Stat label="In progress" value={stats.progress} icon={Loader} tone="bg-blue-50 text-blue-600" />
        <Stat label="Completed" value={stats.done} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
        <Stat label="Blocked" value={stats.blocked} icon={AlertTriangle} tone="bg-rose-50 text-rose-600" />
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Today's tasks</h2>
            <Link to="/tasks" className="text-sm text-indigo-600 hover:underline">All tasks</Link>
          </div>
          {tasksQ.loading ? <ListSkeleton /> : tasksQ.error ? <ErrorState message={tasksQ.error} onRetry={tasksQ.refresh} /> : mine.length === 0 ? (
            <EmptyState icon={Sparkles} title="A clear day ahead" hint="Add a task or use Quick add (press Q) to plan what you'll tackle." action={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus /> Add task</Button>} />
          ) : (
            <div className="space-y-5">
              {GROUPS.map((g) => {
                const items = mine.filter((t) => t.status === g.status)
                if (!items.length) return null
                return (
                  <div key={g.status}>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className={cn('size-2 rounded-full', g.dot)} />{g.status}
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] normal-case">{items.length}</span>
                    </div>
                    <div className="space-y-2.5">
                      {items.map((t) => <TaskRow key={t.id} task={t} compact onEdit={(x) => { setEditing(x); setOpen(true) }} onDelete={setDeleting} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {openCount === 0 && doneTasks.length > 0 && (
          <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">All tasks for today are done. Nice work! 🎉</p>
        )}

        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-emerald-600" />Completed today</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{doneTasks.length + doneNotes.length}</span>
          </div>
          {doneTasks.length + doneNotes.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
              Tick the checkbox on a task or note to move it here.
            </p>
          ) : (
            <div className="space-y-2.5">
              {doneTasks.map((t) => <TaskRow key={`t${t.id}`} task={t} compact onEdit={(x) => { setEditing(x); setOpen(true) }} onDelete={setDeleting} />)}
              {doneNotes.map((n) => (
                <div key={`n${n.id}`} className="flex items-start gap-3 rounded-2xl border border-l-4 border-emerald-200 border-l-emerald-500 bg-emerald-50/60 p-3.5">
                  <Checkbox className="mt-1" checked onCheckedChange={() => toggleNote(n)} aria-label="Mark note as not done" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><StickyNoteIcon className="size-3" />Note</p>
                    <p className="mt-0.5 text-sm text-muted-foreground line-through">{n.title ? `${n.title}: ` : ''}{n.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><StickyNoteIcon className="size-4 text-amber-500" />Sticky notes</h2>
            <div className="flex items-center gap-3 text-sm">
              <button className="text-indigo-600 hover:underline" onClick={() => { setNoteEditing(null); setNoteOpen(true) }}>New note</button>
              <Link to="/notes" className="text-indigo-600 hover:underline">All notes</Link>
            </div>
          </div>
          <form className="mb-5 flex gap-2" onSubmit={async (e) => {
            e.preventDefault()
            if (!quick.trim()) return
            if (await mutate(() => api.post('/notes', { content: quick, kind: 'quick' }), 'Quick note saved')) setQuick('')
          }}>
            <Input className="bg-white" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Stick a quick note… (Enter to save)" />
            <Button type="submit" className="bg-amber-500 text-white hover:bg-amber-600"><Plus /> Stick it</Button>
          </form>
          {notesQ.loading ? <ListSkeleton rows={2} /> : stickies.length === 0 ? (
            <EmptyState icon={StickyNoteIcon} title="No notes yet" hint="Jot down testing observations and follow-ups as they come up." />
          ) : (
            <div className="grid grid-cols-1 gap-x-5 gap-y-7 px-1 pt-2 sm:grid-cols-2 xl:grid-cols-3">
              {stickies.map((n) => <StickyNote key={n.id} note={n} compact onEdit={(x) => { setNoteEditing(x); setNoteOpen(true) }} onDelete={setNoteDeleting} />)}
            </div>
          )}
        </section>
        </div>

        <aside className="space-y-6">
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Bell className="size-4 text-indigo-600" />Upcoming reminders</CardTitle>
              <Link to="/reminders" className="text-xs text-indigo-600 hover:underline">View all</Link>
            </div>
            <CardContent className="space-y-1 p-4 pt-1">
              {remindersQ.loading ? <div className="h-16 animate-pulse rounded-lg bg-muted/70" /> : reminders.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No upcoming reminders</p>
              ) : reminders.map((r) => {
                const overdue = reminderAt(r.remind_date, r.remind_time).getTime() < Date.now()
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
                    <div className={cn('flex w-14 shrink-0 flex-col items-center rounded-lg py-1 text-center', overdue ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700')}>
                      <span className="text-[10px] uppercase">{friendlyDate(r.remind_date).split(',')[0]}</span>
                      <span className="text-xs font-semibold">{time12(r.remind_time)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      {(r.ticket_key || overdue) && <p className="text-xs text-muted-foreground">{overdue ? 'Overdue' : r.ticket_key}</p>}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><CircleDashed className="size-4 text-violet-600" />On my plate</CardTitle>
              <Link to="/jira" className="text-xs text-indigo-600 hover:underline">Jira tracker</Link>
            </div>
            <CardContent className="space-y-1 p-4 pt-1">
              {(ticketsQ.data ?? []).filter((t) => t.status !== 'Done').slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.ticket_key}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.title}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
              {!ticketsQ.loading && !(ticketsQ.data ?? []).some((t) => t.status !== 'Done') && <p className="py-4 text-center text-sm text-muted-foreground">No open tickets</p>}
            </CardContent>
          </Card>
        </aside>
      </div>

      <TaskDialog open={open} onOpenChange={setOpen} item={editing} />
      <NoteDialog open={noteOpen} onOpenChange={setNoteOpen} item={noteEditing} />
      <ConfirmDialog open={!!noteDeleting} onOpenChange={(o) => !o && setNoteDeleting(null)} title="Delete this note?" description="This note will be permanently removed."
        onConfirm={() => noteDeleting && mutate(() => api.del(`/notes/${noteDeleting.id}`), 'Note deleted')} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this task?" description={`"${deleting?.title}" will be permanently removed.`}
        onConfirm={() => deleting && mutate(() => api.del(`/tasks/${deleting.id}`), 'Task deleted')} />
    </div>
  )
}
