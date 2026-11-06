INSERT INTO envelopes (id, title, body, unlock_at, is_placeholder)
VALUES ('parking', 'Denah parkir', 'Lihat denah dan jalur parkir motor serta mobil.', NULL, 0)
ON CONFLICT(id) DO UPDATE SET
  body = excluded.body,
  unlock_at = NULL,
  is_placeholder = 0
WHERE envelopes.body = '' AND envelopes.is_placeholder = 1;
