# Data yang perlu diisi penyelenggara BHARASENA

Gunakan daftar ini sebagai handoff ke panitia. Isi hanya informasi yang sudah disahkan; kolom yang belum final boleh tetap kosong agar situs menampilkan plakat atau amplop tertutup. Semua jam menggunakan WIB (`Asia/Jakarta`).

## 1. Wajib sebelum situs diumumkan

| Data | Yang perlu dikirim panitia | Status saat ini |
| --- | --- | --- |
| Identitas acara | Konfirmasi ejaan “BHARASENA”, “Prom Night Batalyon 6”, “Batalyon Bhara Arsa Nawasena”, dan “SMAN 2 Taruna Bhayangkara” | Ada di rancangan; perlu persetujuan final |
| Tanggal | Konfirmasi 11–13 Desember 2026 dan hari acara yang benar-benar dibuka untuk peserta | Tanggal tersedia; jam belum final |
| Lokasi | Nama tempat, alamat lengkap, titik Google Maps, petunjuk gerbang masuk, serta tanggal kapan boleh diumumkan | Belum diisi |
| Kontak resmi | Nomor/akun panitia yang boleh dipublikasikan, jam layanan, dan penanggung jawab pembaruan | Belum diisi |
| Akses peserta/tamu | Siapa yang boleh masuk, dokumen/tiket yang harus dibawa, aturan pendamping/tamu, dan kebijakan terlambat | Belum diisi |
| Persetujuan penampil | Konfirmasi tertulis bahwa Budi Doremi memang boleh diumumkan di situs dan materi promosi | Nama tampil; bukti persetujuan perlu panitia |
| Penanggung jawab konten | Satu admin utama dan satu cadangan untuk koreksi cepat selama acara; buat akun melalui `npm run admin:create` | Belum ditentukan |

## 2. Dapat menyusul, tetapi harus final sebelum dipublikasikan di bagiannya

| Bagian situs | Format data yang dibutuhkan |
| --- | --- |
| Rundown tiga hari | Untuk setiap sesi: tanggal, jam mulai–selesai WIB, judul, deskripsi singkat, urutan, dan status final. Jam contoh tidak boleh dianggap jadwal resmi. |
| Penampilan Budi Doremi | Tanggal/jam tampil WIB, durasi bila boleh diumumkan, serta waktu pembukaan informasi jika masih embargo. |
| Dress code | Aturan busana yang jelas, pengecualian, dan apakah ada warna atau aksesori wajib. |
| Pengumuman terbaru | Judul, isi singkat, tanggal berlaku, kapan diterbitkan, dan siapa yang menyetujui. |
| Amplop informasi | Untuk lokasi, akses, busana, dan kabar: teks final serta `unlock_at` jika baru boleh dibuka pada waktu tertentu. Jangan kirim isi rahasia ke frontend sebelum waktunya. |
| Galeri | Foto yang sudah diizinkan untuk tayang, nama fotografer/kredit, hari pengambilan, teks alternatif singkat, dan urutan foto. Hindari foto peserta yang tidak punya izin publikasi. |
| Foto penampil | Press kit resmi beserta izin/lisensi dan kredit. Jika tidak ada, foto Wikimedia yang sekarang boleh dipakai dengan atribusi Agnis Putriana / CC BY-SA 4.0 dan keterangan edit yang terlihat. |
| Identitas berbagi | Domain final, judul/deskripsi pratinjau WhatsApp, dan gambar OG 1200×630 yang disetujui panitia. |

## 3. Keputusan operasional sebelum rilis

- Hosting dan domain resmi, pihak yang mengelola DNS/HTTPS, serta alamat email teknis untuk insiden.
- Siapa yang boleh menyetujui pesan Dinding Pesan dan standar moderasinya. Pesan pengunjung masuk sebagai **pending**; maksimal 80 karakter, nama panggilan opsional maksimal 20 karakter.
- Jadwal backup database, lokasi salinan cadangan, dan petugas yang dapat melakukan restore.
- Tanggal/jam ketika situs boleh dipublikasikan dan siapa pemberi persetujuan akhir.

## Yang tidak perlu dikumpulkan

Nama lengkap, nomor telepon, email, atau identitas peserta untuk undangan personal. Kartu undangan dibuat sepenuhnya di browser. Situs juga tidak membutuhkan RSVP, pembayaran, atau pelacakan pihak ketiga.

## Kredit foto saat ini

`assets/budi-doremi.jpg` berasal dari [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Lelaki_dengan_gitar_kecil.jpg), kredit Agnis Putriana, lisensi [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Foto dipotong dan diolah warnanya; atribusi serta keterangan edit harus tetap terlihat selama aset ini digunakan.
