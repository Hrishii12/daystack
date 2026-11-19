export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const TASK_STATUS = ['Not Started', 'In Progress', 'Blocked', 'Done'];
export const PRIORITY = ['Low', 'Medium', 'High'];
export const TICKET_STATUS = ['To Do', 'In Progress', 'In Review', 'Blocked', 'Done'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// schema: { field: { type, required, max, oneOf, default, nullable } }
export function validate(body, schema, { partial = false } = {}) {
  const errors = {};
  const out = {};
  for (const [key, rule] of Object.entries(schema)) {
    let v = body?.[key];
    if (v === undefined) {
      if (partial) continue;
      if (rule.required) { errors[key] = 'Required'; continue; }
      if ('default' in rule) out[key] = rule.default;
      continue;
    }
    if (v === null || v === '') {
      if (rule.required) { errors[key] = 'Required'; continue; }
      out[key] = rule.type === 'int' || rule.nullable ? null : (rule.default ?? '');
      continue;
    }
    switch (rule.type) {
      case 'string':
        if (typeof v !== 'string') { errors[key] = 'Must be text'; continue; }
        v = v.trim();
        if (rule.required && !v) { errors[key] = 'Required'; continue; }
        if (v.length > (rule.max ?? 500)) { errors[key] = `Max ${rule.max ?? 500} characters`; continue; }
        break;
      case 'date':
        if (typeof v !== 'string' || !DATE_RE.test(v)) { errors[key] = 'Use YYYY-MM-DD'; continue; }
        break;
      case 'time':
        if (typeof v !== 'string' || !TIME_RE.test(v)) { errors[key] = 'Use HH:MM'; continue; }
        break;
      case 'int':
        v = Number(v);
        if (!Number.isInteger(v)) { errors[key] = 'Must be an integer'; continue; }
        break;
      case 'bool':
        v = v ? 1 : 0;
        break;
      case 'url':
        v = String(v).trim();
        try {
          const u = new URL(v);
          if (!/^https?:$/.test(u.protocol)) throw new Error('bad protocol');
        } catch {
          errors[key] = 'Must be a valid http(s) URL';
          continue;
        }
        break;
    }
    if (rule.oneOf && !rule.oneOf.includes(v)) { errors[key] = `Must be one of: ${rule.oneOf.join(', ')}`; continue; }
    out[key] = v;
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);
  return out;
}
