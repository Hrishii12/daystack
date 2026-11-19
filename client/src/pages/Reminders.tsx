import { useEffect, useState } from 'react'
import { AlarmClock, BellOff, Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, EmptyState, ErrorState, ListSkeleton, PageHeader, Pill } from '@/components/common'
import { ReminderDialog } from '@/components/forms'
import { api, type Reminder } from '@/lib/api'
import { friendlyDate, reminderAt, time12 } from '@/lib/dates'
import { mutate, useApi } from '@/lib/useApi'
import { cn } from '@/lib/utils'

export default function Reminders() {
  const { data, loading, error, refresh } = useApi<Reminder[]>('/reminders')
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Reminder | null>(null)
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(id) }, [])

  const now = Date.now()
  const all = data ?? []
  const active = all.filter((r) => !r.completed)
  const overdue = active.filter((r) => reminderAt(r.remind_date, r.remind_time).getTime() < now)
  const upcoming = active.filter((r) => reminderAt(r.remind_date, r.remind_time).getTime() >= now)
  const completed = all.filter((r) => r.completed).reverse()

  const Row = ({ r, tone }: { r: Reminder; tone: 'overdue' | 'upcoming' | 'done' }) => (
    <div className="group flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-md">
      <Button variant="outline" size="icon" aria-label={r.completed ? 'Mark as not done' : 'Mark done'}
        className={cn('rounded-full', r.completed && 'border-emerald-300 bg-emerald-50 text-emerald-600')}
        onClick={() => mutate(() => api.put(`/reminders/${r.id}`, { completed: !r.completed }), r.completed ? 'Reminder reopened' : 'Reminder completed')}>
        {r.completed ? <RotateCcw /> : <Check />}
      </Button>
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', tone === 'done' && 'text-muted-foreground line-through')}>{r.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn(tone === 'overdue' && 'font-medium text-rose-600')}>{friendlyDate(r.remind_date)} · {time12(r.remind_time)}</span>
          {r.ticket_key && <Pill tone="violet">{r.ticket_key}</Pill>}
          {r.task_title && <Pill tone="blue" className="max-w-[12rem] truncate">{r.task_title}</Pill>}
        </div>
      </div>
      <div className="flex shrink-0 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100">
        <Button variant="ghost" size="icon" aria-label="Edit reminder" onClick={() => { setEditing(r); setOpen(true) }}><Pencil /></Button>
        <Button variant="ghost" size="icon" aria-label="Delete reminder" className="text-rose-600 hover:text-rose-700" onClick={() => setDeleting(r)}><Trash2 /></Button>
      </div>
    </div>
  )

  const Section = ({ title, items, tone, count }: { title: string; items: Reminder[]; tone: 'overdue' | 'upcoming' | 'done'; count?: boolean }) =>
    items.length === 0 ? null : (
      <section className="mb-6">
        <h2 className={cn('mb-2 flex items-center gap-2 text-sm font-semibold', tone === 'overdue' && 'text-rose-700')}>
          {title} {count !== false && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{items.length}</span>}
        </h2>
        <div className="space-y-2.5">{items.map((r) => <div key={r.id}>{Row({ r, tone })}</div>)}</div>
      </section>
    )

  return (
    <div>
      <PageHeader title="Reminders" subtitle="In-app alerts fire while DayStack is open. Enable browser alerts from the sidebar."
        actions={<Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setEditing(null); setOpen(true) }}><Plus /> New reminder</Button>} />

      {loading ? <ListSkeleton rows={4} /> : error ? <ErrorState message={error} onRetry={refresh} /> : all.length === 0 ? (
        <EmptyState icon={AlarmClock} title="No reminders set" hint="Set a reminder so follow-ups never slip."
          action={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus /> New reminder</Button>} />
      ) : (
        <>
          {Section({ title: "Overdue", items: overdue, tone: "overdue" })}
          {Section({ title: "Upcoming", items: upcoming, tone: "upcoming" })}
          {overdue.length + upcoming.length === 0 && (
            <div className="mb-6"><EmptyState icon={BellOff} title="Nothing pending" hint="You're all caught up." /></div>
          )}
          {Section({ title: "Completed", items: completed, tone: "done" })}
        </>
      )}

      <ReminderDialog open={open} onOpenChange={setOpen} item={editing} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this reminder?" description={`"${deleting?.title}" will be removed.`}
        onConfirm={() => deleting && mutate(() => api.del(`/reminders/${deleting.id}`), 'Reminder deleted')} />
    </div>
  )
}
