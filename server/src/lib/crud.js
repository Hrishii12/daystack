import { Router } from 'express';
import { db } from '../db/index.js';
import { HttpError, validate } from './validate.js';

function mapDbError(e) {
  if (/UNIQUE/.test(e.message)) return new HttpError(409, 'Already exists', { ticket_key: 'This ticket ID is already tracked' });
  if (/FOREIGN KEY/.test(e.message)) return new HttpError(400, 'Linked item does not exist');
  return e;
}

// Small generic CRUD router; hooks allow per-resource behaviour.
export function crudRouter({ table, schema, label, orderBy = `${table}.id DESC`, filters = [], select, hasUpdatedAt = true, beforeSave, onCreate, onUpdate, onDelete }) {
  const r = Router();
  const base = select || `SELECT * FROM ${table}`;
  const find = (id) => db.prepare(`${base} WHERE ${table}.id = ?`).get(id);

  r.get('/', (req, res) => {
    const where = [];
    const args = [];
    for (const f of filters) {
      const v = req.query[f.param];
      if (v === undefined || v === '' || v === 'all') continue;
      if (f.op === 'bool') { where.push(`${f.column} = ?`); args.push(v === 'true' || v === '1' ? 1 : 0); }
      else if (f.op === 'like') { where.push(`${f.column} LIKE ?`); args.push(`%${v}%`); }
      else { where.push(`${f.column} = ?`); args.push(v); }
    }
    const sql = `${base}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${orderBy}`;
    res.json(db.prepare(sql).all(...args));
  });

  r.get('/:id', (req, res) => {
    const row = find(req.params.id);
    if (!row) throw new HttpError(404, `${label} not found`);
    res.json(row);
  });

  r.post('/', (req, res) => {
    let data = validate(req.body, schema);
    if (beforeSave) data = beforeSave(data, null);
    const cols = Object.keys(data);
    let info;
    try {
      info = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...Object.values(data));
    } catch (e) { throw mapDbError(e); }
    const row = find(info.lastInsertRowid);
    onCreate?.(row);
    res.status(201).json(row);
  });

  r.put('/:id', (req, res) => {
    const existing = find(req.params.id);
    if (!existing) throw new HttpError(404, `${label} not found`);
    let data = validate(req.body, schema, { partial: true });
    if (beforeSave) data = beforeSave(data, existing);
    const cols = Object.keys(data);
    if (cols.length) {
      try {
        db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(',')}${hasUpdatedAt ? ", updated_at = datetime('now')" : ''} WHERE id = ?`)
          .run(...Object.values(data), req.params.id);
      } catch (e) { throw mapDbError(e); }
    }
    const row = find(req.params.id);
    onUpdate?.(row, existing);
    res.json(row);
  });

  r.delete('/:id', (req, res) => {
    const existing = find(req.params.id);
    if (!existing) throw new HttpError(404, `${label} not found`);
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    onDelete?.(existing);
    res.status(204).end();
  });

  return r;
}

