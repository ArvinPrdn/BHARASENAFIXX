# Pencarian Google untuk BHARASENA

Alamat utama: **https://www.bharasena.com/**. Domain tanpa `www` sudah mengarah
ke alamat ini. Semua canonical, metadata sosial, data WebSite, dan sitemap memakai
alamat yang sama, termasuk ketika kode ditayangkan pada alamat Vercel lain.

## Yang tersedia di kode

- Judul dan deskripsi halaman menyebut BHARASENA, sekolah, dan tanggal acara.
- Canonical halaman utama dan galeri mengarah ke domain resmi.
- Data terstruktur WebSite membantu Google memahami nama BHARASENA.
- Metadata Open Graph memakai logo yang sudah ada untuk pratinjau tautan.
- `robots.txt` menunjuk ke `https://www.bharasena.com/sitemap.xml`.
- Sitemap saat ini hanya memuat halaman utama. Tambahkan halaman galeri setelah
  foto acara diterbitkan. Jangan masukkan URL admin, API, atau fragmen `#bagian`.

## Setelah deployment pada domain resmi selesai

1. Buka [Google Search Console](https://search.google.com/search-console).
2. Tambahkan properti **URL prefix** `https://www.bharasena.com/`, atau properti
   **Domain** `bharasena.com` bila pemilik dapat mengubah DNS.
3. Verifikasi kepemilikan. Untuk URL prefix, pilih metode **HTML tag** dan pasang
   tag yang diberikan Google di `<head>` halaman utama. Tag verifikasi ini bersifat
   publik. Jangan membuat kode verifikasi sendiri. Untuk properti Domain, gunakan
   nilai TXT persis yang diberikan Google di penyedia DNS domain.
4. Di menu **Sitemaps**, kirim `sitemap.xml`.
5. Di **URL Inspection**, periksa `https://www.bharasena.com/`, jalankan pemeriksaan
   URL langsung, kemudian pilih **Request indexing** bila tersedia.
6. Pantau laporan pengindeksan dan performa. Status HTTP 200 atau sitemap terkirim
   tidak membuktikan Google sudah mengindeks halaman atau memberi posisi pertama.

Cantumkan tautan domain resmi pada profil Instagram/TikTok BHARASENA dan pada
halaman sekolah atau panitia bila pengelolanya mengizinkan. Utamakan informasi
acara yang akurat dan lengkap; jangan menambahkan kata kunci tersembunyi.

Pengindeksan dan peringkat memerlukan pemrosesan Google dan tidak bisa dijamin.
Tidak ada biaya Google untuk pengindeksan organik atau penggunaan Search Console.

Referensi:
- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Canonical URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Site names](https://developers.google.com/search/docs/appearance/site-names)
- [Permintaan pengindeksan ulang](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
