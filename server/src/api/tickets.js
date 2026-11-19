import { logActivity, today } from '../db/index.js';
import { crudRouter } from '../lib/crud.js';
import { PRIORITY, TICKET_STATUS } from '../lib/validate.js';

export default crudRouter({
  table: 'tickets',
  label: 'Ticket',
  hasUpdatedAt: false,
  orderBy: 'tickets.on_plate DESC, tickets.date_added DESC, tickets.id DESC',
  schema: {
    ticket_key: { type: 'string', required: true, max: 40 },
    title: { type: 'string', required: true, max: 200 },
    url: { type: 'url', default: '' },
    status: { type: 'string', oneOf: TICKET_STATUS, default: 'To Do' },
    priority: { type: 'string', oneOf: PRIORITY, default: 'Medium' },
    notes: { type: 'string', max: 4000, default: '' },
    on_plate: { type: 'bool', default: 1 },
    date_added: { type: 'date', default: today() },
  },
  filters: [
    { param: 'status', column: 'tickets.status' },
    { param: 'priority', column: 'tickets.priority' },
    { param: 'on_plate', column: 'tickets.on_plate', op: 'bool' },
  ],
  beforeSave(data) {
    if (data.ticket_key) data.ticket_key = data.ticket_key.toUpperCase();
    if ('date_added' in data && !data.date_added) data.date_added = today();
    return data;
  },
  onCreate: (t) => logActivity('ticket', `Picked up ${t.ticket_key}`),
});
