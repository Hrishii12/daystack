import express from 'express';
import cors from 'cors';
import api from './api/index.js';
import { HttpError } from './lib/validate.js';
import { db } from './db/index.js';
import { seed } from './db/seed.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', api);

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Route not found')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Seed demo data on a fresh database only.
if (db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n === 0 && db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n === 0) {
  seed();
  console.log('Seeded demo data');
}

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`DayStack API listening on http://localhost:${port}`));

