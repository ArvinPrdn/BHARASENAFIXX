# Progress

Dokumen ini mencatat bukti kerja per fase. Setiap baris harus menyebut perintah yang benar-benar
dijalankan; status “planned” bukan hasil pemeriksaan.

| Fase | Status | Bukti terakhir | Catatan |
| --- | --- | --- | --- |
| Audit prototipe statis | complete | `AUDIT.md` | Audit akar masalah dan batasan file lama ditulis. |
| Fondasi Node/TypeScript | in progress | `package.json`, `tsconfig.json` | Dependensi npm belum dapat dipasang karena akses registry diblokir. |
| Database dan migrasi | complete | `npm run migrate`, `npm run seed` | SQLite native Node 26, backup API juga teruji. |
| Frontend ballroom | complete | `_qa/desktop-full-cdp.png`, `_qa/mobile-full-cdp.png` | Browser check lulus tanpa overflow horizontal. |
| API dan Dinding Pesan | complete | `QA.md`, `server.mjs` | Health, content, ETag, validasi pesan, filter tautan, dan SSR diuji. |
| Panel admin dan autentikasi | complete | `src/lib/auth.mjs`, `src/lib/admin-content.mjs`, `/admin` | Pengaturan, rundown, amplop, penampil, pengumuman, galeri, moderasi, audit, dan upload teruji manual. |
| Pengujian dan hardening | in progress | `QA.md`, `node --check`, HTTP checks | Lint/Vitest/Playwright/typecheck penuh terblokir dependensi. |
| Deployment | in progress | `Dockerfile`, `docker-compose.yml`, `Caddyfile.example` | File deployment ditulis; Docker belum tersedia untuk smoke test. |

## Catatan lingkungan

- `npm install --package-lock-only` belum berhasil pada sesi pengembangan ini karena akses ke
  `registry.npmjs.org` ditolak (EACCES). Tidak ada klaim lint, typecheck, test, build, atau E2E
  lulus sampai dependensi terpasang dan perintah dijalankan.
- Docker tidak tersedia pada sesi pengembangan ini.
