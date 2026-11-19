import { Router } from 'express';
import { db, logActivity } from '../db/index.js';
import { crudRouter } from '../lib/crud.js';
import { HttpError, validate, TASK_STATUS, PRIORITY } from '../lib/validate.js';

const taskSchema = {
  title: { type: 'string', required: true, max: 200 },
  description: { type: 'string', max: 2000, default: '' },
  status: { type: 'string', oneOf: TASK_STATUS, default: 'Not Started' },
  priority: { type: 'string', oneOf: PRIORITY, default: 'Medium' },
  due_date: { type: 'date', required: true },
  jira_id: { type: 'string', max: 40, nullable: true },
};

const router = Router();

// Carry unfinished tasks forward to another day. Declared before the CRUD mount.
router.post('/carry-forward', (req, res) => {
  const { from, to } = validate(req.body, {
    from: { type: 'date', required: true },
    to: { type: 'date', required: true },
  });
  const ids = req.body.ids;
  if (ids !== undefined && !Array.isArray(ids)) throw new HttpError(400, 'ids must be an array');
  // Without ids: every unfinished task due on/before `from` moves forward.
  const rows = ids?.length
    ? db.prepare(`SELECT * FROM tasks WHERE status != 'Done' AND id IN (${ids.map(() => '?').join(',')})`).all(...ids.map(Number))
    : db.prepare(`SELECT * FROM tasks WHERE status != 'Done' AND due_date <= ?`).all(from);
  const upd = db.prepare(`UPDATE tasks SET due_date = ?, carried_count = carried_count + 1, updated_at = datetime('now') WHERE id = ?`);
  for (const t of rows) upd.run(to, t.id);
  if (rows.length) logActivity('carried', `Carried ${rows.length} task${rows.length > 1 ? 's' : ''} forward to ${to}`, from);
  res.json({ moved: rows.length, ids: rows.map((t) => t.id) });
});

router.use('/', crudRouter({
  table: 'tasks',
  label: 'Task',
  schema: taskSchema,
  orderBy: `tasks.due_date ASC, CASE tasks.priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, tasks.id DESC`,
  filters: [
    { param: 'status', column: 'tasks.status' },
    { param: 'priority', column: 'tasks.priority' },
    { param: 'due_date', column: 'tasks.due_date' },
    { param: 'q', column: 'tasks.title', op: 'like' },
  ],
  beforeSave(data, existing) {
    if (data.status === 'Done' && existing?.status !== 'Done') data.completed_at = new Date().toISOString();
    if (data.status && data.status !== 'Done' && existing?.status === 'Done') data.completed_at = null;
    return data;
  },
  onCreate: (t) => logActivity('created', `Added task "${t.title}"`),
  onUpdate(t, old) {
    if (t.status !== old.status) {
      logActivity(t.status === 'Done' ? 'completed' : 'status', t.status === 'Done' ? `Completed "${t.title}"` : `"${t.title}" moved to ${t.status}`);
    }
  },
  onDelete: (t) => logActivity('deleted', `Deleted task "${t.title}"`),
}));

export default router;
