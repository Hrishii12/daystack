import { crudRouter } from '../lib/crud.js';

export default crudRouter({
  table: 'reminders',
  label: 'Reminder',
  hasUpdatedAt: false,
  select: `SELECT reminders.*, tasks.title AS task_title, tickets.ticket_key AS ticket_key
           FROM reminders LEFT JOIN tasks ON tasks.id = reminders.task_id LEFT JOIN tickets ON tickets.id = reminders.ticket_id`,
  orderBy: 'reminders.remind_date ASC, reminders.remind_time ASC',
  schema: {
    title: { type: 'string', required: true, max: 200 },
    remind_date: { type: 'date', required: true },
    remind_time: { type: 'time', required: true },
    task_id: { type: 'int' },
    ticket_id: { type: 'int' },
    completed: { type: 'bool', default: 0 },
  },
  filters: [{ param: 'completed', column: 'reminders.completed', op: 'bool' }],
});
