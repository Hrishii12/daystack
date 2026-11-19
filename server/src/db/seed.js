import { db, fmtDate } from './index.js';
import { fileURLToPath } from 'node:url';

const offset = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return fmtDate(d);
};

export function seed() {
  const JIRA = 'https://yourcompany.atlassian.net/browse/';
  const insTicket = db.prepare('INSERT INTO tickets (ticket_key, title, url, status, priority, notes, on_plate, date_added) VALUES (?,?,?,?,?,?,?,?)');
  const tickets = [
    ['PAY-1423', 'Refund API returns 500 for partial refunds', 'In Progress', 'High', 'Repro on staging with order #88213. Suspect rounding in refund calculator.', 1, -3],
    ['PAY-1431', 'Add idempotency key to checkout endpoint', 'In Review', 'Medium', 'PR is up, waiting on review from Priya.', 1, -5],
    ['PLAT-902', 'Upgrade Node runtime to v22 in CI pipelines', 'To Do', 'Low', 'Check native deps before bumping.', 1, -1],
    ['PAY-1440', 'Webhook retries not honoring backoff', 'Blocked', 'High', 'Blocked on infra team enabling the queue dashboard.', 1, -2],
    ['UI-377', 'Receipt page layout breaks on small screens', 'Done', 'Low', 'Shipped in release 4.12.', 0, -8],
  ];
  const ticketIds = {};
  for (const [key, title, status, prio, notes, plate, off] of tickets) {
    const r = insTicket.run(key, title, JIRA + key, status, prio, notes, plate, offset(off));
    ticketIds[key] = r.lastInsertRowid;
  }

  const insTask = db.prepare('INSERT INTO tasks (title, description, status, priority, due_date, jira_id, completed_at, carried_count) VALUES (?,?,?,?,?,?,?,?)');
  const now = new Date().toISOString();
  const tasks = [
    ['Reproduce partial refund failure on staging', 'Use order #88213 and capture request/response payloads.', 'In Progress', 'High', 0, 'PAY-1423', null, 0],
    ['Write unit tests for refund rounding', 'Cover 0.01 edge cases and multi-currency.', 'Not Started', 'High', 0, 'PAY-1423', null, 0],
    ['Address review comments on idempotency PR', '', 'In Progress', 'Medium', 0, 'PAY-1431', null, 1],
    ['Follow up with infra on queue dashboard', 'Ping in #infra-support if no reply by noon.', 'Blocked', 'High', 0, 'PAY-1440', null, 0],
    ['Standup notes and update Jira statuses', '', 'Done', 'Low', 0, null, now, 0],
    ['Audit CI pipelines for Node version pins', 'List every repo using node:18 images.', 'Not Started', 'Low', 1, 'PLAT-902', null, 0],
    ['Prepare demo for sprint review', 'Show refund fix and idempotency flow.', 'Not Started', 'Medium', 2, null, null, 0],
    ['Review teammate PR for receipt tweaks', '', 'Not Started', 'Medium', -1, 'UI-377', null, 0],
    ['Update runbook for webhook retries', '', 'Done', 'Medium', -1, 'PAY-1440', new Date(Date.now() - 864e5).toISOString(), 0],
  ];
  const taskIds = [];
  for (const [title, desc, status, prio, off, jira, done, carried] of tasks) {
    taskIds.push(insTask.run(title, desc, status, prio, offset(off), jira, done, carried).lastInsertRowid);
  }

  const insNote = db.prepare('INSERT INTO notes (title, content, kind, task_id, ticket_id) VALUES (?,?,?,?,?)');
  insNote.run('Refund bug findings', 'Partial refunds over 3 line items fail when tax is split. Rounding differs between the order service and the refund calculator.', 'note', taskIds[0], ticketIds['PAY-1423']);
  insNote.run('Idempotency design', 'Key = hash(merchant_id + client_key). TTL 24h in Redis. Return stored response on replay.', 'note', null, ticketIds['PAY-1431']);
  insNote.run('', 'Retest checkout on Safari - cart badge not updating after coupon applied.', 'quick', null, null);
  insNote.run('', 'Ask Priya about feature flag naming convention.', 'quick', null, null);

  const insRem = db.prepare('INSERT INTO reminders (title, remind_date, remind_time, task_id, ticket_id, completed) VALUES (?,?,?,?,?,?)');
  insRem.run('Ping infra about queue dashboard', offset(0), '23:30', taskIds[3], ticketIds['PAY-1440'], 0);
  insRem.run('Submit timesheet', offset(0), '17:30', null, null, 0);
  insRem.run('Sprint review demo', offset(2), '11:00', taskIds[6], null, 0);
  insRem.run('Check PR approval status', offset(-1), '15:00', taskIds[2], ticketIds['PAY-1431'], 0);
  insRem.run('Send standup summary', offset(-1), '10:00', null, null, 1);

  const insAct = db.prepare('INSERT INTO activity (day, type, message) VALUES (?,?,?)');
  insAct.run(offset(-2), 'created', 'Added task "Review teammate PR for receipt tweaks"');
  insAct.run(offset(-2), 'completed', 'Completed "Draft idempotency design doc"');
  insAct.run(offset(-1), 'completed', 'Completed "Update runbook for webhook retries"');
  insAct.run(offset(-1), 'carried', 'Carried 1 task forward to ' + offset(0));
  insAct.run(offset(0), 'completed', 'Completed "Standup notes and update Jira statuses"');
}

// `npm run seed` wipes and reseeds.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--reset')) {
    db.exec('DELETE FROM activity; DELETE FROM reminders; DELETE FROM notes; DELETE FROM tasks; DELETE FROM tickets; DELETE FROM sqlite_sequence;');
  }
  seed();
  console.log('Database seeded');
}

