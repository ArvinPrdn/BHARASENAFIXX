# Arsitektur BHARASENA

Dokumen ini adalah catatan keputusan teknis yang perlu dibaca sebelum menambah dependensi
atau endpoint. Tujuan arsitektur adalah menjaga permukaan kode kecil, mudah diaudit, dan
tetap nyaman dijalankan di Windows maupun Linux.

## Bentuk sistem

```text
Browser
  ├── HTML/CSS ballroom (server-rendered agar tetap terbaca tanpa JavaScript)
  └── src/scripts/experience.ts (interaksi progresif, satu loop animasi)
             │
             ▼
Node.js 26 HTTP server
  ├── halaman publik dan aset statis
  ├── /api/content, /api/messages, /healthz
  ├── /admin (sesi cookie + CSRF)
  └── middleware keamanan dan logging request-id
             │
             ▼
node:sqlite → data/bharasena.db
  ├── migrations/*.sql
  ├── konten acara, rundown, performer, galeri
  ├── pesan pending/approved/rejected
  └── sesi admin dan audit log
```

Panel `/admin` mengubah settings acara, rundown, amplop, jadwal penampil, pengumuman,
galeri, dan status moderasi pesan. File galeri disimpan di `data/uploads/` dengan nama acak;
route `/media/:name` hanya melayani file yang sudah berstatus published. Unggahan saat ini
memeriksa magic bytes JPG/PNG/WebP dan batas 6 MB. Pemrosesan ulang Sharp belum diaktifkan
karena dependensi runtime sengaja tidak dipasang pada keputusan native Node ini; tambahkan
Sharp sebelum menerima foto produksi jika pembersihan EXIF/resizing wajib.

Semua akses data melewati satu modul database. Waktu disimpan sebagai ISO 8601 UTC dan
ditampilkan dalam `Asia/Jakarta`. Klien menerima `serverNow` dari server untuk countdown;
jam perangkat tidak dipercaya.

## Keputusan

### ADR-001 — Server Node native menggantikan Astro

Pemilik proyek secara eksplisit memilih “gausah Astro 6” setelah brief awal menyebut Astro.
Karena itu tidak ada `astro.config.mjs` atau adapter Astro di repositori ini. Server HTTP
native memberi kontrol langsung atas header, sesi, dan respons endpoint; struktur halaman
tetap dapat dipisah sebagai template kecil bila kebutuhan bertambah. Jika keputusan ini
berubah, migrasi ke Astro harus menjadi ADR baru dan mencantumkan dampak pada build serta
deployment.

### ADR-002 — `node:sqlite` tanpa ORM atau runtime dependency

Node 26 menyediakan `node:sqlite`. Memakainya menghindari kegagalan kompilasi
`better-sqlite3` pada sebagian Windows dan menjaga runtime tanpa paket eksternal. SQL tetap
berparameter, migrasi berupa file bernomor, dan PRAGMA `foreign_keys`, `busy_timeout`, serta
WAL diatur saat koneksi dibuat. Bila deployment menuntut Node di bawah 22, keputusan ini
harus ditinjau ulang; fallback yang disetujui adalah `better-sqlite3`, bukan ORM.

### ADR-003 — Validasi dan unggahan mengikuti batas platform

Brief awal menyebut Zod dan Sharp. Keduanya tidak dibawa sebagai runtime dependency agar
instalasi offline dan Windows tetap ringan. Validasi server akan memakai fungsi boundary
yang eksplisit dan teruji; unggahan galeri akan menerima format yang dapat diverifikasi
sebelum disajikan. Menambah Zod/Sharp hanya boleh dilakukan jika kebutuhan final dan jalur
instalasi production sudah diuji; catat alasannya pada ADR ini sebelum merge.

### ADR-004 — Interaksi publik satu file

Interaksi ballroom diletakkan di `src/scripts/experience.ts` dengan fungsi `init*` kecil,
guard elemen, `try/catch` per fitur, dukungan keyboard, dan cabang `prefers-reduced-motion`.
Tidak ada React, Vue, Tailwind, GSAP, atau layanan analytics pihak ketiga.

## Batas keamanan

- Rahasia hanya dari environment; `.env`, database, upload, dan backup di-ignore Git.
- Cookie sesi `httpOnly`, `SameSite=Lax`, Secure saat HTTPS. Mutasi admin memeriksa Origin
  dan token CSRF.
- SQL selalu memakai parameter. Pesan pengguna disanitasi, dibatasi panjangnya, dan melalui
  honeypot, jebakan waktu, rate limit, filter tautan/email/telepon, serta moderasi admin.
- CSP, HSTS produksi, `frame-ancestors`, Referrer-Policy, Permissions-Policy, dan
  `X-Content-Type-Options` dipasang dari satu middleware.
- Rate limiter memori mengasumsikan satu instance. Deployment multi-instance memerlukan
  penyimpan terkoordinasi sebagai keputusan baru.

## Performa dan aksesibilitas

HTML dikirim penuh agar halaman bermakna tanpa JavaScript. Efek besar dimatikan untuk
`prefers-reduced-motion`; target sentuh minimal 44px dan teks isi minimal 16px di mobile.
Gambar responsif hanya diproses setelah format dan ukuran diverifikasi. Target QA adalah
LCP < 2,5 detik pada 4G dan Lighthouse mobile Performance ≥85, Accessibility/Best
Practices/SEO ≥95; angka tersebut belum diklaim sebelum dijalankan.

## Data yang sengaja tidak dikumpulkan

Tidak ada pendaftaran/RSVP, pembayaran, profil peserta, nama kartu undangan yang dikirim ke
server, atau tracking pihak ketiga. Kartu undangan dirender dan dibagikan sepenuhnya dari
browser. Data acara yang belum dikonfirmasi tetap tertutup di UI, bukan diisi dengan fakta
rekaan.
