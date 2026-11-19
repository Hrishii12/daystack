import { useState } from 'react'
import { ExternalLink, Pencil, Pin, PinOff, Plus, Ticket as TicketIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog, EmptyState, ErrorState, ListSkeleton, PageHeader, PriorityBadge, SimpleSelect } from '@/components/common'
import { TicketDialog } from '@/components/forms'
import { api, PRIORITIES, TICKET_STATUSES, type Ticket } from '@/lib/api'
import { friendlyDate } from '@/lib/dates'
import { mutate, useApi } from '@/lib/useApi'
import { cn } from '@/lib/utils'

export default function Jira() {
  const { data, loading, error, refresh } = useApi<Ticket[]>('/tickets')
  const [plateOnly, setPlateOnly] = useState(true)
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [editing, setEditing] = useState<Ticket | null>(null)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Ticket | null>(null)

  const all = data ?? []
  const list = all.filter((t) => (!plateOnly || t.on_plate) && (status === 'all' || t.status === status) && (priority === 'all' || t.priority === priority))
  const onPlate = all.filter((t) => t.on_plate && t.status !== 'Done').length

  return (
    <div>
      <PageHeader title="Jira Tracker" subtitle={`${onPlate} ticket${onPlate === 1 ? '' : 's'} currently on your plate`}
        actions={<Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setEditing(null); setOpen(true) }}><Plus /> Add ticket</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-muted p-1">
          {[{ v: true, l: 'On my plate' }, { v: false, l: 'All tickets' }].map((o) => (
            <button key={o.l} onClick={() => setPlateOnly(o.v)}
              className={cn('rounded-lg px-3 py-1 text-sm transition-colors', plateOnly === o.v ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{o.l}</button>
          ))}
        </div>
        <div className="w-40"><SimpleSelect className="h-9" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, ...TICKET_STATUSES]} /></div>
        <div className="w-40"><SimpleSelect className="h-9" value={priority} onChange={setPriority} options={[{ value: 'all', label: 'All priorities' }, ...PRIORITIES]} /></div>
      </div>

      {loading ? <ListSkeleton rows={4} /> : error ? <ErrorState message={error} onRetry={refresh} /> : list.length === 0 ? (
        <EmptyState icon={TicketIcon} title="No tickets here" hint="Add the Jira tickets you're working on to keep them in one place."
          action={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus /> Add ticket</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((t) => (
            <Card key={t.id} className={cn('gap-0 py-0 transition-shadow hover:shadow-md', !t.on_plate && 'opacity-70')}>
              <CardContent className="flex h-full flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {t.url ? (
                      <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline">
                        {t.ticket_key}<ExternalLink className="size-3" />
                      </a>
                    ) : <span className="text-sm font-semibold text-indigo-600">{t.ticket_key}</span>}
                    <p className="mt-0.5 font-medium leading-snug">{t.title}</p>
                  </div>
                  <PriorityBadge priority={t.priority} />
                </div>
                {t.notes && <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{t.notes}</p>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-32"><SimpleSelect className="h-7 text-xs" value={t.status} options={TICKET_STATUSES}
                      onChange={(v) => mutate(() => api.put(`/tickets/${t.id}`, { status: v }), `${t.ticket_key} → ${v}`)} /></div>
                    <span className="text-xs text-muted-foreground">Added {friendlyDate(t.date_added)}</span>
                  </div>
                  <div className="flex">
                    <Button variant="ghost" size="icon" title={t.on_plate ? 'Remove from my plate' : 'Put on my plate'} aria-label="Toggle on plate"
                      onClick={() => mutate(() => api.put(`/tickets/${t.id}`, { on_plate: !t.on_plate }), t.on_plate ? 'Removed from plate' : 'Added to plate')}>
                      {t.on_plate ? <PinOff /> : <Pin />}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Edit ticket" onClick={() => { setEditing(t); setOpen(true) }}><Pencil /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete ticket" className="text-rose-600 hover:text-rose-700" onClick={() => setDeleting(t)}><Trash2 /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TicketDialog open={open} onOpenChange={setOpen} item={editing} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Remove this ticket?" description={`${deleting?.ticket_key} will be removed from DayStack. Linked notes and reminders are kept.`}
        onConfirm={() => deleting && mutate(() => api.del(`/tickets/${deleting.id}`), 'Ticket removed')} />
    </div>
  )
}
