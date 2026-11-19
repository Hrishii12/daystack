import { crudRouter } from '../lib/crud.js';

export default crudRouter({
  table: 'notes',
  label: 'Note',
  select: `SELECT notes.*, tasks.title AS task_title, tickets.ticket_key AS ticket_key
           FROM notes LEFT JOIN tasks ON tasks.id = notes.task_id LEFT JOIN tickets ON tickets.id = notes.ticket_id`,
  orderBy: 'notes.updated_at DESC, notes.id DESC',
  schema: {
    title: { type: 'string', max: 200, default: '' },
    content: { type: 'string', required: true, max: 10000 },
    kind: { type: 'string', oneOf: ['note', 'quick'], default: 'note' },
    task_id: { type: 'int' },
    ticket_id: { type: 'int' },
    completed: { type: 'bool', default: 0 },
  },
  beforeSave(data, existing) {
    if ('completed' in data && data.completed !== (existing?.completed ?? 0)) {
      data.completed_at = data.completed ? new Date().toISOString() : null;
    }
    return data;
  },
  filters: [
    { param: 'kind', column: 'notes.kind' },
    { param: 'task_id', column: 'notes.task_id' },
    { param: 'ticket_id', column: 'notes.ticket_id' },
  ],
});
