# Dinding Pesan otomatis dan notifikasi Telegram

Target implementasi: `ArvinPrdn/BHARASENAFIXX`.
Target hosting: proyek Vercel `bharasena` pada akun `hilmannn11`.

Pengunjung mengisi form **di web**. Pesan valid langsung tersimpan dan tampil di web.
Bot `@PesanBharasenaBot` hanya mengirim notifikasi ke chat pribadi pemilik.
Tidak ada tahap persetujuan dan tidak ada webhook Telegram yang harus dipasang.

## Perilaku

- Minimal **3 kata**, maksimal **80 karakter**; nama opsional, maksimal 20 karakter.
- Kata kasar, HTML, tautan, alamat email, dan nomor telepon ditolak oleh server.
- Maksimal empat kiriman per alamat IP dalam 15 menit, memakai penghitung Redis
  yang tetap bekerja antar-instance Vercel. IP asli tidak disimpan atau dikirim ke bot.
- Kiriman ulang dengan request ID yang sama tidak menghasilkan pesan/notifikasi baru.
- Web menampilkan 40 pesan terbaru dan menyegarkan daftar setiap 30 detik saat tab aktif.
- Gangguan Telegram tidak menghapus pesan yang sudah tersimpan di web. Notifikasi gagal
  dicatat sebagai event tanpa isi pesan atau token; pengiriman notifikasi tidak diulang otomatis.
- Ketika konfigurasi belum lengkap, form Vercel tetap tertutup. Tidak ada token di HTML/JS publik.

## Penyimpanan dan environment Vercel

Telegram bukan penyimpanan feed web. Hubungkan database **Upstash Redis** ke proyek
Vercel `bharasena` milik Hilman yang menerbitkan repo ini. Gunakan akun/database persisten; jangan memakai
database percobaan sementara. Pilih paket yang disetujui pemilik akun; kode ini tidak membuat
database atau mengaktifkan paket berbayar.

Tambahkan environment berikut pada proyek yang benar, untuk **Production**:

| Nama | Isi |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | HTTPS REST URL database Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token database, simpan sebagai secret |
| `APP_SECRET` | Nilai acak minimal 32 karakter, simpan sebagai secret |
| `PUBLIC_ORIGIN` | Alamat utama web, misalnya `https://domain-yang-dipakai.com` |
| `MESSAGE_WALL_ENABLED` | `true` setelah penyimpanan dan konfigurasi diperiksa |
| `MESSAGE_WALL_NAMESPACE` | `bharasena:wall:v1`, atau namespace khusus proyek ini |
| `TELEGRAM_BOT_TOKEN` | Token bot **baru** dari BotFather, simpan sebagai secret |
| `TELEGRAM_CHAT_ID` | ID chat pribadi pemilik, bilangan positif |

Jangan masukkan secret ke Git, kode browser, variable berawalan `PUBLIC_`/`NEXT_PUBLIC_`,
atau screenshot. Token bot yang pernah dibagikan perlu diganti lewat BotFather `/revoke`.
Jangan kirim token penggantinya ke chat. Tambahkan langsung lewat pengaturan environment Vercel.

Kode tidak membuka form hanya karena bot sudah dibuat. Vercel harus memiliki penyimpanan,
origin, secret aplikasi, dan flag `MESSAGE_WALL_ENABLED=true`. Token/chat Telegram bersifat
opsional bagi feed web; isi keduanya untuk mengaktifkan notifikasi pribadi.

## Menemukan chat ID tanpa menyebarkan token

1. Buka [@PesanBharasenaBot](https://t.me/PesanBharasenaBot), lalu tekan **Start**.
2. Simpan token baru di `.env` lokal yang diabaikan Git: `TELEGRAM_BOT_TOKEN=...`.
3. Jalankan `npm run telegram:discover`. Script menampilkan nama bot dan ID chat pribadi,
   tanpa menampilkan token atau isi percakapan. Pilih ID milikmu, lalu isi `TELEGRAM_CHAT_ID`.
4. Dengan environment lain terisi, jalankan `npm run telegram:check`. Perintah ini memeriksa
   identitas bot, chat pribadi, dan koneksi Redis tanpa mengirim pesan atau mengubah webhook.
5. Simpan environment di proyek Vercel `bharasena` milik Hilman, lalu redeploy. Memperbarui environment saja tidak
   mengubah deployment yang sudah terbit.

## Verifikasi sesudah deploy

- `GET /api/messages` mengembalikan `enabled: true` dan array `messages`.
- Kirim contoh minimal tiga kata lewat form. Pesan langsung muncul di web dan notifikasi
  tiba di chat pribadi. Pesan uji menjadi konten publik; gunakan teks yang layak ditampilkan.
- Dua kata ditolak; tautan/kata kasar ditolak; kiriman kelima dalam 15 menit ditolak.
- API tidak boleh mengirim token, IP hash, atau konfigurasi bot pada respons publik.
- Untuk menutup kiriman, set `MESSAGE_WALL_ENABLED=false` dan redeploy. Pesan terbit tetap
  dapat dibaca. Token database tetap di server dan data tidak dihapus oleh perubahan flag.

`npm run dev` tetap memakai SQLite lokal, dengan publikasi otomatis dan notifikasi Telegram
jika token/chat lokal diisi. Vercel memakai `api/messages.mjs` dengan Redis persisten.
Pengujian otomatis memakai mock Telegram/Redis dan tidak mengirim pesan nyata.

Referensi: [Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage),
[Upstash REST API](https://upstash.com/docs/redis/features/restapi),
[Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js).
