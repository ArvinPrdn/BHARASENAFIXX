# QA terakhir

Pemeriksaan yang sudah dijalankan pada 11 Oktober 2026:

- `node --check` untuk server, modul database, auth, security, dan interaction script: lulus.
- `npm run migrate`, `npm run seed`, `npm run build`, dan `npm run backup -- data/backups/qa-backup.db`: lulus.
- Server lokal: `GET /healthz` mengembalikan `200` dan `{"ok":true,"database":"sqlite"}`.
- `GET /` mengembalikan `200`, HTML memiliki `lang="id"`, title BHARASENA, Dinding Pesan,
  dan `server-now`.
- `GET /api/content` mengembalikan `200` dengan ETag dan tidak mengirim body amplop tersegel.
- `POST /api/messages` menerima pesan valid sebagai `202`; tautan ditolak oleh filter server.
- Login admin sementara, render panel, simpan moderasi, dan upload JPG melalui multipart form diuji;
  upload menghasilkan redirect `303`, lalu akun dan aset QA dihapus kembali.
- Panel admin menampilkan editor pengaturan, 9 sesi rundown, 4 amplop, penampil, pengumuman,
  galeri, pesan, dan audit log; semua mutasi memakai token CSRF dan pemeriksaan Origin.
- Route publik hanya menyajikan stylesheet, interaction script, data event, favicon, dan aset di
  `assets/`; request ke `.env.example`, `server.mjs`, dan modul internal mengembalikan `404`.
- Parameter `?now=` pada halaman publik diabaikan; preview waktu hanya dipakai bila sesi admin
  tersedia.
- Pemeriksaan browser Chromium headless pada viewport 1440×900 dan 390×844: tidak ada overflow
  horizontal, form pesan dan lima tombol kristal terdeteksi, title dan bahasa benar.
- Screenshot QA tersimpan di `_qa/desktop-full-cdp.png` dan `_qa/mobile-full-cdp.png`.

Pemeriksaan yang belum bisa dinyatakan lulus:

- `npm ci`, lint, Vitest, Playwright test, dan typecheck penuh karena registry/npm packages tidak
  tersedia di lingkungan ini.
- Docker Compose dan Lighthouse karena Docker tidak terpasang.
- Pengujian login admin end-to-end memerlukan akun panitia yang dibuat melalui
  `npm run admin:create`.
