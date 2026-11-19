import { ArrowRightToLine, Pencil, Repeat, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { PriorityBadge, Pill, SimpleSelect, StatusBadge } from '@/components/common'
import { api, TASK_STATUSES, type Task } from '@/lib/api'
import { addDays, friendlyDate, todayStr } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { mutate } from '@/lib/useApi'

interface Props {
  task: Task
  onEdit?: (t: Task) => void
  onDelete?: (t: Task) => void
  compact?: boolean
  inlineStatus?: boolean
}

// Card colour per status so tasks are distinguishable at a glance.
export const TASK_STYLE: Record<Task['status'], string> = {
  'Not Started': 'bg-slate-50 border-slate-200 border-l-slate-400',
  'In Progress': 'bg-blue-50/70 border-blue-200 border-l-blue-500',
  Blocked: 'bg-rose-50/70 border-rose-200 border-l-rose-500',
  Done: 'bg-emerald-50/60 border-emerald-200 border-l-emerald-500',
}

export function toggleDone(t: Task) {
  return mutate(() => api.put(`/tasks/${t.id}`, { status: t.status === 'Done' ? 'Not Started' : 'Done' }), t.status === 'Done' ? 'Task reopened' : 'Nice, task completed')
}

export function carryTask(t: Task, to: string) {
  return mutate(() => api.post('/tasks/carry-forward', { from: t.due_date, to, ids: [t.id] }), `Moved to ${friendlyDate(to).toLowerCase()}`)
}

export default function TaskRow({ task: t, onEdit, onDelete, compact, inlineStatus }: Props) {
  const done = t.status === 'Done'
  const overdue = !done && t.due_date < todayStr()
  return (
    <div className={cn('group flex items-start gap-3 rounded-2xl border border-l-4 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-md', TASK_STYLE[t.status], done && 'opacity-80')}>
      <Checkbox className="mt-1" checked={done} onCheckedChange={() => toggleDone(t)} aria-label="Mark complete" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn('font-medium leading-snug', done && 'text-muted-foreground line-through')}>{t.title}</p>
          {t.jira_id && <Pill tone="violet">{t.jira_id}</Pill>}
          {t.carried_count > 0 && !done && <Pill tone="amber"><Repeat className="size-3" />carried {t.carried_count}×</Pill>}
        </div>
        {!compact && t.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {!inlineStatus && <StatusBadge status={t.status} />}
          <PriorityBadge priority={t.priority} />
          <span className={cn('text-xs', overdue ? 'font-medium text-rose-600' : 'text-muted-foreground')}>
            {overdue ? 'Overdue · ' : ''}{friendlyDate(t.due_date)}
          </span>
        </div>
      </div>
      {inlineStatus && (
        <div className="hidden w-36 shrink-0 sm:block">
          <SimpleSelect className="h-7" value={t.status} options={TASK_STATUSES}
            onChange={(v) => mutate(() => api.put(`/tasks/${t.id}`, { status: v }), 'Status updated')} />
        </div>
      )}
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
        {!done && (
          <Button variant="ghost" size="icon" title="Carry forward to tomorrow" aria-label="Carry forward to tomorrow"
            onClick={() => carryTask(t, addDays(t.due_date < todayStr() ? todayStr() : t.due_date, 1))}>
            <ArrowRightToLine />
          </Button>
        )}
        {onEdit && <Button variant="ghost" size="icon" title="Edit" aria-label="Edit task" onClick={() => onEdit(t)}><Pencil /></Button>}
        {onDelete && <Button variant="ghost" size="icon" title="Delete" aria-label="Delete task" className="text-rose-600 hover:text-rose-700" onClick={() => onDelete(t)}><Trash2 /></Button>}
      </div>
    </div>
  )
}
