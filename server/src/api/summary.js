import { Router } from 'express';
import { db, today, fmtDate } from '../db/index.js';
import { validate } from '../lib/validate.js';

const router = Router();

router.get('/summary', (req, res) => {
  const date = req.query.date || today();
  validate({ date }, { date: { type: 'date', required: true } });
  const dayTasks = db.prepare(
    `SELECT * FROM tasks WHERE due_date = ? OR substr(completed_at, 1, 10) = ? ORDER BY id`
  ).all(date, date);
  // completed_at is stored as UTC ISO; compare on the local day in JS.
  const isDoneOn = (t) => t.completed_at && fmtDate(new Date(t.completed_at)) === date;
  const completed = dayTasks.filter((t) => t.status === 'Done' && (isDoneOn(t) || t.due_date === date));
  const blocked = dayTasks.filter((t) => t.status === 'Blocked' && t.due_date === date);
  const pending = dayTasks.filter((t) => t.status !== 'Done' && t.status !== 'Blocked' && t.due_date === date);
  const activity = db.prepare('SELECT * FROM activity WHERE day = ? ORDER BY id DESC').all(date);
  res.json({ date, completed, pending, blocked, activity, total: completed.length + pending.length + blocked.length });
});

router.get('/history', (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 90);
  const rows = db.prepare(
    `SELECT day,
       SUM(type = 'completed') AS completed,
       SUM(type = 'created') AS created,
       SUM(type = 'carried') AS carried,
       COUNT(*) AS events
     FROM activity GROUP BY day ORDER BY day DESC LIMIT ?`
  ).all(days);
  res.json(rows);
});

export default router;
