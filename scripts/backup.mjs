import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { backup } from 'node:sqlite';
import { openDb, closeDb } from '../src/lib/db.mjs';

const destination = resolve(process.argv[2] || `data/backups/bharasena-${new Date().toISOString().replaceAll(':','-')}.db`);
mkdirSync(dirname(destination), { recursive: true });
try { await backup(openDb(), destination); console.log(`Backup tersimpan di ${destination}`); }
finally { closeDb(); }
