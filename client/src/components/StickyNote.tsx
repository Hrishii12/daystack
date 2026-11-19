import { Link2, Pencil, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { api, type Note } from '@/lib/api'
import { relTime } from '@/lib/dates'
import { mutate } from '@/lib/useApi'
import { cn } from '@/lib/utils'

// Each note gets a stable colour and tilt derived from its id.
const COLORS = [
  { bg: 'bg-yellow-100', edge: 'border-yellow-200', tape: 'bg-yellow-300/60', fold: 'from-yellow-200' },
  { bg: 'bg-pink-100', edge: 'border-pink-200', tape: 'bg-pink-300/60', fold: 'from-pink-200' },
  { bg: 'bg-sky-100', edge: 'border-sky-200', tape: 'bg-sky-300/60', fold: 'from-sky-200' },
  { bg: 'bg-lime-100', edge: 'border-lime-200', tape: 'bg-lime-300/60', fold: 'from-lime-200' },
  { bg: 'bg-orange-100', edge: 'border-orange-200', tape: 'bg-orange-300/60', fold: 'from-orange-200' },
  { bg: 'bg-violet-100', edge: 'border-violet-200', tape: 'bg-violet-300/60', fold: 'from-violet-200' },
]
const TILTS = [-1.6, 1.2, -0.6, 1.8, -1.2, 0.7]

interface Props {
  note: Note
  onEdit?: (n: Note) => void
  onDelete?: (n: Note) => void
  compact?: boolean
}

export const toggleNote = (n: Note) =>
  mutate(() => api.put(`/notes/${n.id}`, { completed: !n.completed }), n.completed ? 'Note reopened' : 'Note moved to Completed')

export default function StickyNote({ note: n, onEdit, onDelete, compact }: Props) {
  const c = COLORS[n.id % COLORS.length]
  const tilt = TILTS[(n.id * 7) % TILTS.length]
  return (
    <div
      style={{ transform: `rotate(${tilt}deg)` }}
      className={cn(
        'group relative flex flex-col rounded-sm border p-4 pt-5 text-slate-800 shadow-[2px_4px_10px_rgba(0,0,0,0.10)] transition-transform duration-200 hover:z-10 hover:!rotate-0 hover:-translate-y-0.5 hover:shadow-[3px_8px_16px_rgba(0,0,0,0.15)]',
        c.bg, c.edge, compact ? 'min-h-28' : 'min-h-40',
      )}
    >
      {/* tape */}
      <span className={cn('absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 rotate-[-2deg] rounded-[2px] shadow-sm', c.tape)} />
      {/* folded corner */}
      <span className={cn('pointer-events-none absolute bottom-0 right-0 size-5 bg-gradient-to-tl to-transparent', c.fold)} />

      {(onEdit || onDelete) && (
        <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
          {onEdit && n.kind === 'note' && (
            <button aria-label="Edit note" className="rounded p-1 text-slate-600 hover:bg-black/10" onClick={() => onEdit(n)}><Pencil className="size-3.5" /></button>
          )}
          {onDelete && (
            <button aria-label="Delete note" className="rounded p-1 text-slate-600 hover:bg-black/10 hover:text-rose-600" onClick={() => onDelete(n)}><Trash2 className="size-3.5" /></button>
          )}
        </div>
      )}

      <div className="flex items-start gap-2.5">
        <Checkbox className="mt-0.5 border-slate-400 bg-white/70" checked={!!n.completed} onCheckedChange={() => toggleNote(n)} aria-label={n.completed ? 'Mark note as not done' : 'Mark note as done'} />
        <div className={cn('min-w-0 flex-1', n.completed && 'opacity-60 [&_*]:line-through')}>
          {n.title && <h3 className="pr-10 text-[15px] font-semibold leading-snug">{n.title}</h3>}
          <p className={cn('whitespace-pre-line text-sm leading-relaxed text-slate-700', n.title && 'mt-1', compact ? 'line-clamp-4' : 'line-clamp-6')}>{n.content}</p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 text-[11px] text-slate-500">
        {n.ticket_key && <span className="inline-flex items-center gap-1 rounded bg-white/60 px-1.5 py-0.5 font-medium text-slate-700"><Link2 className="size-3" />{n.ticket_key}</span>}
        {n.task_title && <span className="max-w-[10rem] truncate rounded bg-white/60 px-1.5 py-0.5 text-slate-700">{n.task_title}</span>}
        <span className="ml-auto">{relTime(n.updated_at)}</span>
      </div>
    </div>
  )
}
