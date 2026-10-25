UPDATE settings
SET value = '11 Des: baju muslim (muslim) atau batik/bebas rapi (nonmuslim). 12 Des pagi: atasan putih polos dan bawahan training hitam; malam: seragam PDSUS berjas Taruna Bhayangkara. 13 Des: baju prom night semi PDL. Warna tambahan, aksesori terlarang, dan contoh outfit: menyusul.',
    updated_at = CURRENT_TIMESTAMP
WHERE key = 'dress_code';

UPDATE settings
SET value = 'Hadir untuk seluruh anggota SMAN 2 Taruna Bhayangkara dan tamu tertentu yang diundang. Parkir dan konsumsi tersedia. Yang wajib dibawa: menyusul. Tiket/kartu identitas/undangan: menyusul. Aturan masuk, keterlambatan, dan barang terlarang: menyusul.',
    updated_at = CURRENT_TIMESTAMP
WHERE key = 'admission';

UPDATE envelopes
SET body = 'Hadir untuk seluruh anggota SMAN 2 Taruna Bhayangkara dan tamu tertentu yang diundang. Parkir dan konsumsi tersedia. Yang wajib dibawa: menyusul. Tiket/kartu identitas/undangan: menyusul. Aturan masuk, keterlambatan, dan barang terlarang: menyusul.',
    is_placeholder = 0
WHERE id = 'admission';

UPDATE envelopes
SET body = '11 Des: baju muslim (muslim) atau batik/bebas rapi (nonmuslim). 12 Des pagi: atasan putih polos dan bawahan training hitam; malam: seragam PDSUS berjas Taruna Bhayangkara. 13 Des: baju prom night semi PDL. Warna tambahan, aksesori terlarang, dan contoh outfit: menyusul.',
    is_placeholder = 0
WHERE id = 'dress-code';
