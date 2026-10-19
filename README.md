# BHARASENA — Satu Malam di Ballroom

Situs informasi acara untuk BHARASENA. Pengalaman publik memakai bahasa Indonesia dan
memperlakukan scroll sebagai perjalanan satu malam di ballroom: beludru gelap, foil emas,
kristal, dan lantai marmer cermin. Situs ini tidak mengumpulkan RSVP, profil peserta, atau
data pelacakan pihak ketiga. Panel musik memakai pemutar audio lokal. Musik dapat
tetap diputar saat panel ditutup; tekan Hentikan atau jeda pada pemutar untuk menghentikannya.

## Audio lokal

Masukkan rekaman yang telah diizinkan untuk digunakan ke folder `assets/audio/`.
Nama file yang didukung: `melukis-senja`, `mesin-waktu`, `tak-kan-hilang`, dan `tolong`,
dengan ekstensi `.mp3`, `.m4a`, `.ogg`, atau `.wav`.
Panel mendeteksi file saat dibuka. Lagu yang belum memiliki file ditandai
“Audio belum tersedia”. Empat file audio pada salinan lokal ini disediakan pengguna
dari folder Downloads dan tersimpan di `assets/audio/`.

## Status pengembangan

### Publikasi Vercel

Proyek Vercel bernama `bharasena`; judul tab versi publik adalah **Bharasena**.
`vercel.json` menjalankan `node scripts/build-static.mjs` dan hanya menerbitkan
folder `public/`. Paket publik memuat tampilan, audio lokal, kartu undangan, dan
proposal. Database lokal, konfigurasi rahasia, dan panel admin tidak dimasukkan.
Pengiriman pesan ditandai belum dibuka pada versi statis; server lokal tetap
menjalankan backend SQLite. Backend online memerlukan penyimpanan persisten terpisah.

Untuk memeriksa paket publik sebelum deployment:

```text
node scripts/build-static.mjs
```

Repositori sudah memiliki server Node.js native, SQLite, endpoint konten/pesan, panel admin,
moderasi, audit log, dan upload galeri. Pemeriksaan produksi yang bergantung pada instalasi
paket, Docker, dan akun panitia tetap harus dijalankan sebelum rilis. Jangan memakai
`npm run start` sebagai server produksi sebelum seluruh *quality gate* selesai.

Pilihan native ini mengikuti keputusan pemilik proyek sebelumnya, “gausah Astro 6”. Karena
itu proyek tidak membawa Astro atau adapter Astro. Perbedaan dari brief awal dicatat di
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) supaya dapat ditinjau sebelum rilis.

## Prasyarat

- Node.js **24.x** (lihat `.nvmrc`) dan npm 11.
- Git.
- Docker hanya diperlukan untuk pemeriksaan deployment; Docker belum tersedia di lingkungan
  pengembangan ini.

Node 24 dipakai agar SQLite dapat memakai modul bawaan `node:sqlite`, sehingga instalasi
Windows tidak bergantung pada kompilasi modul native `better-sqlite3`.

## Menjalankan di Windows PowerShell

```powershell
nvm use 24
npm install
Copy-Item .env.example .env
npm run migrate
npm run seed
npm run dev
```

Buka `http://localhost:4321`. Jika `nvm` tidak tersedia, pasang Node 24 dari situs
resmi Node lalu jalankan perintah npm yang sama.

## Menjalankan di Linux/macOS

```sh
nvm install
nvm use
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

Perintah npm tidak bergantung pada shell tertentu. Skrip pemeliharaan ditulis dalam
JavaScript agar dapat dijalankan dari PowerShell maupun POSIX shell.

## Perintah proyek

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Menjalankan server dengan mode watch. |
| `npm run build` | Menyiapkan artefak produksi. |
| `npm start` | Menjalankan artefak produksi. |
| `npm run migrate` | Menerapkan migrasi SQL yang belum dijalankan. |
| `npm run seed` | Mengisi konten awal yang sudah dikonfirmasi. |
| `npm run admin:create` | Membuat akun admin secara interaktif. |
| `npm run backup` | Membuat salinan database memakai backup API SQLite. |
| `npm run lint` | Memeriksa aturan ESLint. |
| `npm run typecheck` | Memeriksa TypeScript strict tanpa menghasilkan file. |
| `npm test` | Menjalankan unit test Vitest. |
| `npm run e2e` | Menjalankan smoke test Playwright. |
| `npm run format:check` | Memastikan format Prettier konsisten. |

Status setiap fase dan batas pemeriksaan dicatat di [PROGRESS.md](PROGRESS.md) dan [QA.md](QA.md);
hasil pemeriksaan hanya disebut lulus setelah perintah benar-benar dijalankan.

## Konfigurasi dan rahasia

Salin `.env.example` ke `.env` dan isi `APP_SECRET` dengan nilai acak minimal 32 karakter.
File `.env` dan folder `data/` tidak boleh dikomit. `PUBLIC_ORIGIN` harus sama dengan alamat
yang dipakai pengguna agar pemeriksaan Origin dan URL kanonis berfungsi. Aktifkan
`NODE_ENV=production` hanya ketika HTTPS sudah terminasi di reverse proxy. `TRUST_PROXY=1`
hanya boleh dipakai jika reverse proxy tepercaya mengendalikan header forwarded.

## Data acara

Tanggal yang sudah diberikan panitia adalah 11–13 Desember 2026. Lokasi, jam, kontak,
ketentuan masuk, dan jadwal penampil yang belum dikonfirmasi tetap berupa bidang tertutup
di UI; jangan menggantinya dengan nama atau angka rekaan. Daftar handoff ada di
[CONTENT_CHECKLIST.md](CONTENT_CHECKLIST.md).

## Quality gate sebelum rilis

Jalankan seluruh pemeriksaan berikut dari lingkungan bersih dan simpan hasilnya di laporan
rilis:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run e2e
npm audit --omit=dev
```

Pemeriksaan Docker, Lighthouse, dan uji keamanan manual dijalankan terpisah. Jangan
menyatakan situs siap produksi jika salah satu pemeriksaan belum memiliki bukti.

## Lisensi aset

Foto Budi Doremi di `assets/budi-doremi.jpg` berasal dari Wikimedia Commons, kredit Agnis
Putriana, CC BY-SA 4.0. Atribusi yang terlihat pada halaman harus dipertahankan atau
diganti dengan ketentuan dari press kit resmi panitia.
