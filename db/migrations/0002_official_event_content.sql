INSERT INTO settings (key, value) VALUES
  ('subtitle', 'As one to the light'),
  ('tagline', 'As one to the light'),
  ('venue', 'SMA Negeri 2 Taruna Bhayangkara Jawa Timur, Jl. Pandan, Desa Kembiritan, Kecamatan Genteng, Kabupaten Banyuwangi'),
  ('maps_url', 'https://maps.app.goo.gl/XGUJMNvkwBCmNSDWA?g_st=ac'),
  ('contact', '+62 821-5185-9028 (Humas)'),
  ('instagram', '@asonetothelight_'),
  ('dress_code', '11 Des: baju muslim (muslim) atau batik/bebas rapi (nonmuslim). 12 Des pagi: atasan putih polos dan bawahan training hitam; malam: seragam PDSUS berjas Taruna Bhayangkara. 13 Des: baju prom night semi PDL. Warna tambahan, aksesori terlarang, dan contoh outfit: menyusul.'),
  ('admission', 'Hadir untuk seluruh anggota SMAN 2 Taruna Bhayangkara dan tamu tertentu yang diundang. Parkir dan konsumsi tersedia. Yang wajib dibawa: menyusul. Tiket/kartu identitas/undangan: menyusul. Aturan masuk, keterlambatan, dan barang terlarang: menyusul.'),
  ('event_start_at', '2026-12-11T06:00:00+07:00'),
  ('event_end_at', '2026-12-13T23:00:00+07:00'),
  ('location_final', '1')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;

DELETE FROM rundown;
INSERT INTO rundown (day, start_at, end_at, title, description, is_placeholder, sort_order) VALUES
  ('2026-12-11', '2026-12-11T06:00:00+07:00', '2026-12-11T22:00:00+07:00', 'Taruna Bakti & Istigosah', 'Hari pertama Bharasena diisi dengan Taruna Bakti dan Istigosah. Penampil: Ust. Fuad Naim, pukul 20.00–selesai.', 0, 0),
  ('2026-12-12', '2026-12-12T06:00:00+07:00', '2026-12-12T22:00:00+07:00', 'Colour Festival & Malam Intimate', 'Hari kedua Bharasena menghadirkan Colour Festival dan Malam Intimate. Penampil: DJ Gemoy, pukul 07.50–09.00.', 0, 1),
  ('2026-12-13', '2026-12-13T19:00:00+07:00', '2026-12-13T23:00:00+07:00', 'Malam Puncak · Konser', 'Penutupan Bharasena berupa malam puncak dan konser bersama Budi Doremi, pukul 20.30–selesai. Ada penampil tambahan dari para taruna.', 0, 2);

DELETE FROM performers;
INSERT INTO performers (name, photo_path, scheduled_at, is_announced) VALUES
  ('Ust. Fuad Naim', '', '11 Desember 2026 · 20.00–selesai', 1),
  ('DJ Gemoy', '', '12 Desember 2026 · 07.50–09.00', 1),
  ('Budi Doremi', '/assets/budi-doremi.jpg', '13 Desember 2026 · 20.30–selesai', 1);

INSERT INTO envelopes (id, title, body, unlock_at, is_placeholder) VALUES
  ('venue', 'Tempat acara', 'SMA Negeri 2 Taruna Bhayangkara Jawa Timur, Jl. Pandan, Desa Kembiritan, Kecamatan Genteng, Kabupaten Banyuwangi · Google Maps: https://maps.app.goo.gl/XGUJMNvkwBCmNSDWA?g_st=ac', NULL, 0),
  ('admission', 'Ketentuan masuk', 'Hadir untuk seluruh anggota SMAN 2 Taruna Bhayangkara dan tamu tertentu yang diundang. Parkir dan konsumsi tersedia. Yang wajib dibawa: menyusul. Tiket/kartu identitas/undangan: menyusul. Aturan masuk, keterlambatan, dan barang terlarang: menyusul.', NULL, 0),
  ('dress-code', 'Busana acara', '11 Des: baju muslim (muslim) atau batik/bebas rapi (nonmuslim). 12 Des pagi: atasan putih polos dan bawahan training hitam; malam: seragam PDSUS berjas Taruna Bhayangkara. 13 Des: baju prom night semi PDL. Warna tambahan, aksesori terlarang, dan contoh outfit: menyusul.', NULL, 0),
  ('updates', 'Informasi terbaru', '', NULL, 1)
ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body, unlock_at = excluded.unlock_at, is_placeholder = excluded.is_placeholder;
