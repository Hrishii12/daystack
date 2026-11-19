import { useState } from 'react'
import { AlertTriangle, ArrowRightToLine, CheckCircle2, ChevronLeft, ChevronRight, Clock, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Pill, PriorityBadge } from '@/components/common'
import { api, type HistoryDay, type Summary as SummaryT, type Task } from '@/lib/api'
import { addDays, friendlyDate, longDate, relTime, todayStr } from '@/lib/dates'
import { mutate, useApi } from '@/lib/useApi'
import { cn } from '@/lib/utils'

function Group({ title, icon: Icon, tone, tasks, empty }: { title: string; icon: typeof Clock; tone: string; tasks: Task[]; empty: string }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className={cn('flex size-7 items-center justify-center rounded-lg', tone)}><Icon className="size-4" /></div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tasks.length}</span>
        </div>
        {tasks.length === 0 ? <p className="py-2 text-sm text-muted-foreground">{empty}</p> : (
          <ul className="divide-y">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="flex-1 font-medium">{t.title}</span>
                {t.jira_id && <Pill tone="violet">{t.jira_id}</Pill>}
                <PriorityBadge priority={t.priority} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default function Summary() {
  const [date, setDate] = useState(todayStr())
  const { data, loading, error, refresh } = useApi<SummaryT>(`/summary?date=${date}`)
  const history = useApi<HistoryDay[]>('/history?days=14')
  const isToday = date === todayStr()

  const unfinished = data ? [...data.pending, ...data.blocked] : []
  const nextDay = addDays(date, 1)

  return (
    <div>
      <PageHeader title="Daily Summary" subtitle={longDate(date)}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><ChevronLeft /></Button>
            <Input type="date" className="h-8 w-40" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <Button variant="outline" size="icon" aria-label="Next day" disabled={isToday} onClick={() => setDate(addDays(date, 1))}><ChevronRight /></Button>
          </div>
        } />

      {loading ? <ListSkeleton rows={3} /> : error || !data ? <ErrorState message={error ?? 'No data'} onRetry={refresh} /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'Completed', v: data.completed.length, c: 'text-emerald-600' },
                { l: 'Pending', v: data.pending.length, c: 'text-slate-700' },
                { l: 'Blocked', v: data.blocked.length, c: 'text-rose-600' },
              ].map((s) => (
                <Card key={s.l} className="gap-0 py-0"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className={cn('text-2xl font-semibold tabular-nums', s.c)}>{s.v}</p></CardContent></Card>
              ))}
            </div>

            <Group title="Completed" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" tasks={data.completed} empty="Nothing completed on this day." />
            <Group title="Pending" icon={Clock} tone="bg-blue-50 text-blue-600" tasks={data.pending} empty="No pending tasks." />
            <Group title="Blocked" icon={AlertTriangle} tone="bg-rose-50 text-rose-600" tasks={data.blocked} empty="Nothing blocked." />

            {unfinished.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm">
                <span className="text-indigo-900">{unfinished.length} unfinished task{unfinished.length > 1 ? 's' : ''} from {friendlyDate(date).toLowerCase()}.</span>
                <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => mutate(() => api.post('/tasks/carry-forward', { from: date, to: nextDay, ids: unfinished.map((t) => t.id) }), `Carried ${unfinished.length} to ${friendlyDate(nextDay).toLowerCase()}`)}>
                  <ArrowRightToLine /> Carry forward to {friendlyDate(nextDay)}
                </Button>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="gap-0 py-0">
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Activity this day</h3>
                {data.activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity logged.</p> : (
                  <ol className="relative space-y-3 border-l pl-4">
                    {data.activity.map((a) => (
                      <li key={a.id} className="relative text-sm">
                        <span className={cn('absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-background', a.type === 'completed' ? 'bg-emerald-500' : a.type === 'carried' ? 'bg-amber-500' : 'bg-indigo-400')} />
                        <p>{a.message}</p>
                        <p className="text-xs text-muted-foreground">{relTime(a.created_at)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><History className="size-4 text-indigo-600" />History</h2>
        {history.loading ? <ListSkeleton rows={2} /> : (history.data ?? []).length === 0 ? (
          <EmptyState icon={History} title="No history yet" hint="Your daily activity will build up here as you work." />
        ) : (
          <Card className="gap-0 py-0"><CardContent className="divide-y p-0">
            {history.data!.map((h) => (
              <button key={h.day} onClick={() => { setDate(h.day); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className={cn('flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60', h.day === date && 'bg-indigo-50/60')}>
                <span className="font-medium">{friendlyDate(h.day)}</span>
                <span className="flex items-center gap-1.5">
                  <Pill tone="green">{h.completed} done</Pill>
                  <Pill tone="blue">{h.created} added</Pill>
                  {h.carried > 0 && <Pill tone="amber">{h.carried} carried</Pill>}
                </span>
              </button>
            ))}
          </CardContent></Card>
        )}
      </section>
    </div>
  )
}
