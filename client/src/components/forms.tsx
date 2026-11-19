import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FormDialog, SimpleSelect } from '@/components/common'
import {
  api, ApiError, PRIORITIES, TASK_STATUSES, TICKET_STATUSES,
  type Note, type Priority, type Reminder, type Task, type TaskStatus, type Ticket, type TicketStatus,
} from '@/lib/api'
import { addDays, todayStr } from '@/lib/dates'
import { mutate, useApi } from '@/lib/useApi'

type Errors = Record<string, string>

/** Runs a save and captures field-level validation errors from the API. */
function useSave(setErrors: (e: Errors) => void) {
  return async (fn: () => Promise<unknown>, msg: string) => {
    setErrors({})
    try {
      await fn()
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(e.details)
      return mutate(() => Promise.reject(e))
    }
    return mutate(async () => {}, msg)
  }
}

interface DialogProps<T> {
  open: boolean
  onOpenChange: (o: boolean) => void
  item?: T | null
}

// ---------- Task ----------
export function TaskDialog({ open, onOpenChange, item, defaults }: DialogProps<Task> & { defaults?: Partial<Task> }) {
  const blank = { title: '', description: '', status: 'Not Started' as TaskStatus, priority: 'Medium' as Priority, due_date: todayStr(), jira_id: '' }
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Errors>({})
  const save = useSave(setErrors)
  const { data: tickets } = useApi<Ticket[]>('/tickets')

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(item ? { ...blank, ...item, description: item.description ?? '', jira_id: item.jira_id ?? '' } : { ...blank, ...defaults, jira_id: defaults?.jira_id ?? '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? 'Edit task' : 'New task'}
      description="Capture what needs to get done today."
      submitLabel={item ? 'Save changes' : 'Add task'}
      onSubmit={() =>
        save(() => (item ? api.put(`/tasks/${item.id}`, f) : api.post('/tasks', f)), item ? 'Task updated' : 'Task added')
      }
    >
      <Field label="Title" error={errors.title}>
        <Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Reproduce the refund bug" />
      </Field>
      <Field label="Description" error={errors.description}>
        <Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Optional details" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status"><SimpleSelect value={f.status} onChange={(v) => setF({ ...f, status: v as TaskStatus })} options={TASK_STATUSES} /></Field>
        <Field label="Priority"><SimpleSelect value={f.priority} onChange={(v) => setF({ ...f, priority: v as Priority })} options={PRIORITIES} /></Field>
        <Field label="Due date" error={errors.due_date}>
          <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        </Field>
        <Field label="Jira ticket (optional)" error={errors.jira_id}>
          <Input list="ticket-keys" value={f.jira_id} onChange={(e) => setF({ ...f, jira_id: e.target.value.toUpperCase() })} placeholder="PAY-1423" />
          <datalist id="ticket-keys">{tickets?.map((t) => <option key={t.id} value={t.ticket_key}>{t.title}</option>)}</datalist>
        </Field>
      </div>
    </FormDialog>
  )
}

// ---------- Ticket ----------
export function TicketDialog({ open, onOpenChange, item }: DialogProps<Ticket>) {
  const blank = { ticket_key: '', title: '', url: '', status: 'To Do' as TicketStatus, priority: 'Medium' as Priority, notes: '', on_plate: 1, date_added: todayStr() }
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Errors>({})
  const save = useSave(setErrors)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(item ? { ...blank, ...item } : blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? 'Edit ticket' : 'Track a Jira ticket'}
      description="Tickets are added manually. There is no Jira sync."
      submitLabel={item ? 'Save changes' : 'Add ticket'}
      onSubmit={() =>
        save(() => (item ? api.put(`/tickets/${item.id}`, f) : api.post('/tickets', f)), item ? 'Ticket updated' : 'Ticket added')
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Field label="Ticket ID" error={errors.ticket_key} className="col-span-1">
          <Input autoFocus value={f.ticket_key} onChange={(e) => setF({ ...f, ticket_key: e.target.value.toUpperCase() })} placeholder="PAY-1423" />
        </Field>
        <Field label="Title" error={errors.title} className="col-span-2">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ticket summary" />
        </Field>
      </div>
      <Field label="Jira URL" error={errors.url}>
        <Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://yourcompany.atlassian.net/browse/PAY-1423" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Status"><SimpleSelect value={f.status} onChange={(v) => setF({ ...f, status: v as TicketStatus })} options={TICKET_STATUSES} /></Field>
        <Field label="Priority"><SimpleSelect value={f.priority} onChange={(v) => setF({ ...f, priority: v as Priority })} options={PRIORITIES} /></Field>
        <Field label="Date added" error={errors.date_added}>
          <Input type="date" value={f.date_added} onChange={(e) => setF({ ...f, date_added: e.target.value })} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Context, blockers, links…" />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-indigo-600" checked={!!f.on_plate} onChange={(e) => setF({ ...f, on_plate: e.target.checked ? 1 : 0 })} />
        Currently on my plate
      </label>
    </FormDialog>
  )
}

// ---------- Link picker (task / ticket) ----------
function LinkFields({ taskId, ticketId, onChange }: { taskId: string; ticketId: string; onChange: (k: 'task_id' | 'ticket_id', v: string) => void }) {
  const { data: tasks } = useApi<Task[]>('/tasks')
  const { data: tickets } = useApi<Ticket[]>('/tickets')
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Linked task">
        <SimpleSelect value={taskId} onChange={(v) => onChange('task_id', v)}
          options={[{ value: 'none', label: 'None' }, ...(tasks ?? []).filter((t) => t.status !== 'Done' || String(t.id) === taskId).map((t) => ({ value: String(t.id), label: t.title }))]} />
      </Field>
      <Field label="Linked ticket">
        <SimpleSelect value={ticketId} onChange={(v) => onChange('ticket_id', v)}
          options={[{ value: 'none', label: 'None' }, ...(tickets ?? []).map((t) => ({ value: String(t.id), label: `${t.ticket_key} · ${t.title}` }))]} />
      </Field>
    </div>
  )
}
const toId = (v: string) => (v === 'none' ? null : Number(v))

// ---------- Note ----------
export function NoteDialog({ open, onOpenChange, item }: DialogProps<Note>) {
  const blank = { title: '', content: '', task_id: 'none', ticket_id: 'none' }
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Errors>({})
  const save = useSave(setErrors)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(item ? { title: item.title, content: item.content, task_id: item.task_id ? String(item.task_id) : 'none', ticket_id: item.ticket_id ? String(item.ticket_id) : 'none' } : blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const body = { title: f.title, content: f.content, kind: 'note', task_id: toId(f.task_id), ticket_id: toId(f.ticket_id) }
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? 'Edit note' : 'New note'}
      submitLabel={item ? 'Save changes' : 'Add note'}
      onSubmit={() => save(() => (item ? api.put(`/notes/${item.id}`, body) : api.post('/notes', body)), item ? 'Note updated' : 'Note added')}
    >
      <Field label="Title" error={errors.title}>
        <Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Optional title" />
      </Field>
      <Field label="Note" error={errors.content}>
        <Textarea rows={6} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder="Write something…" />
      </Field>
      <LinkFields taskId={f.task_id} ticketId={f.ticket_id} onChange={(k, v) => setF({ ...f, [k]: v })} />
    </FormDialog>
  )
}

// ---------- Reminder ----------
export function ReminderDialog({ open, onOpenChange, item }: DialogProps<Reminder>) {
  const blank = { title: '', remind_date: todayStr(), remind_time: '09:00', task_id: 'none', ticket_id: 'none' }
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Errors>({})
  const save = useSave(setErrors)

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (item) setF({ title: item.title, remind_date: item.remind_date, remind_time: item.remind_time, task_id: item.task_id ? String(item.task_id) : 'none', ticket_id: item.ticket_id ? String(item.ticket_id) : 'none' })
    else {
      const d = new Date(Date.now() + 3600e3)
      setF({ ...blank, remind_date: todayStr(), remind_time: `${String(d.getHours()).padStart(2, '0')}:00` })
      if (d.getDate() !== new Date().getDate()) setF((p) => ({ ...p, remind_date: addDays(todayStr(), 1) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const body = { title: f.title, remind_date: f.remind_date, remind_time: f.remind_time, task_id: toId(f.task_id), ticket_id: toId(f.ticket_id), ...(item ? { completed: false } : {}) }
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? 'Edit reminder' : 'New reminder'}
      submitLabel={item ? 'Save changes' : 'Add reminder'}
      onSubmit={() => save(() => (item ? api.put(`/reminders/${item.id}`, body) : api.post('/reminders', body)), item ? 'Reminder updated' : 'Reminder set')}
    >
      <Field label="What should we remind you about?" error={errors.title}>
        <Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Check PR approval" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={errors.remind_date}><Input type="date" value={f.remind_date} onChange={(e) => setF({ ...f, remind_date: e.target.value })} /></Field>
        <Field label="Time" error={errors.remind_time}><Input type="time" value={f.remind_time} onChange={(e) => setF({ ...f, remind_time: e.target.value })} /></Field>
      </div>
      <LinkFields taskId={f.task_id} ticketId={f.ticket_id} onChange={(k, v) => setF({ ...f, [k]: v })} />
    </FormDialog>
  )
}
