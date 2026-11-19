import { useState } from 'react'
import { NotebookPen, Plus, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/common'
import { NoteDialog } from '@/components/forms'
import StickyNote from '@/components/StickyNote'
import { api, type Note } from '@/lib/api'
import { mutate, useApi } from '@/lib/useApi'

export default function Notes() {
  const { data, loading, error, refresh } = useApi<Note[]>('/notes')
  const [quick, setQuick] = useState('')
  const [editing, setEditing] = useState<Note | null>(null)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Note | null>(null)

  // Finished notes sink to the bottom.
  const notes = [...(data ?? [])].sort((a, b) => a.completed - b.completed)

  const addQuick = async () => {
    if (!quick.trim()) return
    if (await mutate(() => api.post('/notes', { content: quick, kind: 'quick' }), 'Quick note saved')) setQuick('')
  }

  return (
    <div>
      <PageHeader title="Notes" subtitle="Testing observations, follow-ups, and anything worth remembering"
        actions={<Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setEditing(null); setOpen(true) }}><Plus /> New note</Button>} />

      <form className="mb-8 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3" onSubmit={(e) => { e.preventDefault(); addQuick() }}>
        <div className="flex items-center pl-1 text-amber-700"><Zap className="size-4" /></div>
        <Input className="border-amber-200 bg-white" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Quick note: jot down an observation or follow-up and press Enter…" />
        <Button type="submit" className="bg-amber-500 text-white hover:bg-amber-600"><Plus /> Stick it</Button>
      </form>

      {loading ? <ListSkeleton rows={3} /> : error ? <ErrorState message={error} onRetry={refresh} /> : notes.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No notes yet" hint="Stick a quick note above, or write a longer one and link it to a task or Jira ticket."
          action={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus /> New note</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-7 px-1 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => <StickyNote key={n.id} note={n} onEdit={(x) => { setEditing(x); setOpen(true) }} onDelete={setDeleting} />)}
        </div>
      )}

      <NoteDialog open={open} onOpenChange={setOpen} item={editing} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this note?" description="This note will be permanently removed."
        onConfirm={() => deleting && mutate(() => api.del(`/notes/${deleting.id}`), 'Note deleted')} />
    </div>
  )
}
