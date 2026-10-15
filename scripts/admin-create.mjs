import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { hashPassword, cleanText } from '../src/lib/security.mjs';
import { openDb, closeDb } from '../src/lib/db.mjs';

const rl = createInterface({ input, output });
try {
  const username = cleanText(process.argv[2] || await rl.question('Nama pengguna admin: '), 80);
  const password = process.env.ADMIN_PASSWORD || await rl.question('Kata sandi (minimal 12 karakter): ', { hideEchoBack: true });
  if (!username || password.length < 12) throw new Error('Nama pengguna wajib diisi dan kata sandi minimal 12 karakter.');
  const db = openDb();
  db.prepare('INSERT INTO admins (username,password_hash) VALUES (?,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash,failed_attempts=0,locked_until=NULL').run(username, hashPassword(password));
  console.log(`Admin ${username} siap digunakan.`);
  closeDb();
} finally { rl.close(); }
