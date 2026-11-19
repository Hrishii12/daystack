// Starts the real API against a throwaway SQLite file so e2e runs never touch daystack.db.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(dir, '.tmp');
fs.mkdirSync(tmp, { recursive: true });
for (const f of ['e2e.db', 'e2e.db-wal', 'e2e.db-shm']) fs.rmSync(path.join(tmp, f), { force: true });

process.env.DB_PATH = path.join(tmp, 'e2e.db');
process.env.PORT = process.env.E2E_API_PORT || '4100';
await import('../server/src/index.js');
