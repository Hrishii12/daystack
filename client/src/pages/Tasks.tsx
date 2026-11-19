import { useMemo, useState } from 'react'
import { ArrowRightToLine, CheckSquare, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog, EmptyState, ErrorState, ListSkeleton, PageHeader, SimpleSelect } from '@/components/common'
import { TaskDialog } from '@/components/forms'
import TaskRow from '@/components/TaskRow'
import { api, PRIORITIES, TASK_STATUSES, type Task } from '@/lib/api'
import { todayStr } from '@/lib/dates'
import { mutate, useApi } from '@/lib/useApi'
import { cn } from '@/lib/utils'

const RANGES = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
]

export default function Tasks() {
  const { data, loading, error, refresh } = useApi<Task[]>('/tasks')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [range, setRange] = useState('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const today = todayStr()

  const tasks = data ?? []
  const overdue = tasks.filter((t) => t.status !== 'Done' && t.due_date < today)

  const filtered = useMemo(() => tasks.filter((t) => {
    if (status !== 'all' && t.status !== status) return false
    if (priority !== 'all' && t.priority !== priority) return false
    if (range === 'today' && t.due_date !== today) return false
    if (range === 'upcoming' && t.due_date <= today) return false
    if (range === 'overdue' && !(t.status !== 'Done' && t.due_date < today)) return false
    if (q && !`${t.title} ${t.jira_id ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).sort((a, b) => Number(a.status === 'Done') - Number(b.status === 'Done')), [tasks, status, priority, range, q, today])

  const filtering = status !== 'all' || priority !== 'all' || range !== 'all' || q !== ''

  return (
    <div>
      <PageHeader title="Tasks" subtitle={`${tasks.filter((t) => t.status !== 'Done').length} open · ${tasks.filter((t) => t.status === 'Done').length} done`}
        actions={<Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setEditing(null); setOpen(true) }}><Plus /> New task</Button>} />

      {overdue.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{overdue.length} unfinished task{overdue.length > 1 ? 's' : ''} from earlier days.</span>
          <Button size="sm" variant="outline" className="bg-white"
            onClick={() => mutate(() => api.post('/tasks/carry-forward', { from: today, to: today, ids: overdue.map((t) => t.id) }), 'Moved to today')}>
            <ArrowRightToLine /> Carry all to today
          </Button>
        </div>
      )}

      <div className="mb-4 space-y-3">
        <div className="inline-flex rounded-xl bg-muted p-1">
          {RANGES.map((r) => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={cn('rounded-lg px-3 py-1 text-sm transition-colors', range === r.value ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input className="h-9 pl-8" placeholder="Search title or ticket…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="w-40"><SimpleSelect className="h-9" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, ...TASK_STATUSES]} /></div>
          <div className="w-40"><SimpleSelect className="h-9" value={priority} onChange={setPriority} options={[{ value: 'all', label: 'All priorities' }, ...PRIORITIES]} /></div>
          {filtering && <Button variant="ghost" className="h-9" onClick={() => { setStatus('all'); setPriority('all'); setRange('all'); setQ('') }}>Clear</Button>}
        </div>
      </div>

      {loading ? <ListSkeleton rows={5} /> : error ? <ErrorState message={error} onRetry={refresh} /> : filtered.length === 0 ? (
        <EmptyState icon={CheckSquare} title={filtering ? 'No tasks match these filters' : 'No tasks yet'} hint={filtering ? 'Try clearing a filter.' : 'Create your first task to start tracking your day.'}
          action={!filtering && <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus /> New task</Button>} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => <TaskRow key={t.id} task={t} inlineStatus onEdit={(x) => { setEditing(x); setOpen(true) }} onDelete={setDeleting} />)}
        </div>
      )}

      <TaskDialog open={open} onOpenChange={setOpen} item={editing} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this task?" description={`"${deleting?.title}" will be permanently removed.`}
        onConfirm={() => deleting && mutate(() => api.del(`/tasks/${deleting.id}`), 'Task deleted')} />
    </div>
  )
}
