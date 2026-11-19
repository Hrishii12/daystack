import { Router } from 'express';
import tasks from './tasks.js';
import tickets from './tickets.js';
import notes from './notes.js';
import reminders from './reminders.js';
import summary from './summary.js';

// All REST endpoints are mounted here under /api.
const api = Router();
api.use('/tasks', tasks);
api.use('/tickets', tickets);
api.use('/notes', notes);
api.use('/reminders', reminders);
api.use('/', summary); // /summary, /history

export default api;
