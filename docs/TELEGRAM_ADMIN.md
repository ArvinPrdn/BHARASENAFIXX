# Panel admin Telegram

Panel ini memoderasi Dinding Pesan BHARASENA melalui bot Telegram.

Tambahkan environment variable berikut di Vercel:

- `MESSAGE_WALL_ENABLED=true`
- `PUBLIC_ORIGIN=https://domain-kamu`
- `APP_SECRET` minimal 32 karakter
- `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` dengan ID grup admin
- `TELEGRAM_ADMIN_IDS` dengan ID akun admin, dipisahkan koma
- `TELEGRAM_WEBHOOK_SECRET` dengan nilai acak
- `TELEGRAM_ADMIN_CHAT_ID` opsional jika grup admin berbeda dari `TELEGRAM_CHAT_ID`

Setelah deploy, arahkan webhook:

```text
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<DOMAIN>/api/telegram&secret_token=<WEBHOOK_SECRET>
```

Perintah yang tersedia:

- `/pending` mengirim ulang maksimal 10 pesan yang menunggu.
- `/stats` menampilkan jumlah pesan pending dan pesan yang sudah tampil.
- Tombol **Setujui** menampilkan pesan di web.
- Tombol **Tolak** menghapus pesan dari antrean publik.
