import { migrate, openDb, closeDb } from '../src/lib/db.mjs';
try { migrate(openDb()); console.log('Database migrations applied.'); }
finally { closeDb(); }
