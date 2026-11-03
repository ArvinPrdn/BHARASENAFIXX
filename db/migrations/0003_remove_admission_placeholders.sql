UPDATE settings
SET value = TRIM(REPLACE(REPLACE(REPLACE(value,
  ' Yang wajib dibawa: menyusul.', ''),
  ' Tiket/kartu identitas/undangan: menyusul.', ''),
  ' Aturan masuk, keterlambatan, dan barang terlarang: menyusul.', ''))
WHERE key = 'admission';

UPDATE envelopes
SET body = TRIM(REPLACE(REPLACE(REPLACE(body,
  ' Yang wajib dibawa: menyusul.', ''),
  ' Tiket/kartu identitas/undangan: menyusul.', ''),
  ' Aturan masuk, keterlambatan, dan barang terlarang: menyusul.', ''))
WHERE id = 'admission';
