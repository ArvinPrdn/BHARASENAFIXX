import { seed, openDb, closeDb } from '../src/lib/db.mjs';
try { seed(openDb()); console.log('Database seed complete.'); }
finally { closeDb(); }
