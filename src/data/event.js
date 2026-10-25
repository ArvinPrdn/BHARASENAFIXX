/**
 * Public event content and time rules. An empty field means the committee has
 * not published it yet. Placeholder schedule entries exist only to exercise
 * the interface; public views should keep them sealed until real data lands.
 */
export const EVENT = {
  title: 'BHARASENA',
  subtitle: 'As one to the light',
  tagline: 'As one to the light',
  battalion: 'Batalyon Bhara Arsa Nawasena',
  school: 'SMAN 2 Taruna Bhayangkara',
  guestArtist: 'Budi Doremi',
  tz: 'Asia/Jakarta',
  dateStart: '2026-12-11',
  dateEnd: '2026-12-13',
  dateLabel: '11–13 Desember 2026',
  start: '2026-12-11T06:00:00+07:00',
  end: '2026-12-13T23:00:00+07:00',
  timePlaceholder: false,
  venue: 'SMA Negeri 2 Taruna Bhayangkara Jawa Timur, Jl. Pandan, Desa Kembiritan, Kecamatan Genteng, Kabupaten Banyuwangi',
  mapsUrl: 'https://maps.app.goo.gl/XGUJMNvkwBCmNSDWA?g_st=ac',
  artistAt: 'Ust. Fuad Naim · 11 Des 20.00 · DJ Gemoy · 12 Des 07.50 · Budi Doremi · 13 Des 20.30',
  dressCode: '11 Des: baju muslim (muslim) atau batik/bebas rapi (nonmuslim). 12 Des pagi: atasan putih polos dan bawahan training hitam; malam: seragam PDSUS berjas Taruna Bhayangkara. 13 Des: baju prom night semi PDL. Warna tambahan, aksesori terlarang, dan contoh outfit: menyusul.',
  admission: 'Hadir untuk seluruh anggota SMAN 2 Taruna Bhayangkara dan tamu tertentu yang diundang. Parkir dan konsumsi tersedia. Yang wajib dibawa: menyusul. Tiket/kartu identitas/undangan: menyusul. Aturan masuk, keterlambatan, dan barang terlarang: menyusul.',
  contact: '+62 821-5185-9028 (Humas)',
  instagram: '@asonetothelight_',
  showPlaceholderHints: false,
};

// Official day-level programme. More detailed session times can be added by the committee later.
export const rundown = [
  {
    date: '2026-12-11',
    label: '11 Desember',
    weekday: 'Jumat',
    sessions: [{ start: '2026-12-11T06:00:00+07:00', end: '2026-12-11T22:00:00+07:00', title: 'Taruna Bakti & Istigosah', desc: 'Hari pertama Bharasena diisi dengan Taruna Bakti dan Istigosah. Penampil: Ust. Fuad Naim, pukul 20.00–selesai.', placeholder: false }],
  },
  {
    date: '2026-12-12',
    label: '12 Desember',
    weekday: 'Sabtu',
    sessions: [{ start: '2026-12-12T06:00:00+07:00', end: '2026-12-12T22:00:00+07:00', title: 'Colour Festival & Malam Intimate', desc: 'Hari kedua Bharasena menghadirkan Colour Festival dan Malam Intimate. Penampil: DJ Gemoy, pukul 07.50–09.00.', placeholder: false }],
  },
  {
    date: '2026-12-13',
    label: '13 Desember',
    weekday: 'Minggu',
    sessions: [{ start: '2026-12-13T19:00:00+07:00', end: '2026-12-13T23:00:00+07:00', title: 'Malam Puncak · Konser', desc: 'Penutupan Bharasena berupa malam puncak dan konser bersama Budi Doremi, pukul 20.30–selesai. Ada penampil tambahan dari para taruna.', placeholder: false }],
  },
];

// Keep body null while sealed. Shipping unreleased details in a static bundle
// would expose them regardless of what the interface displays.
export const envelopes = [
  { id: 'venue', title: 'Lokasi', body: `${EVENT.venue} · Google Maps: ${EVENT.mapsUrl}`, unlockAt: null, placeholder: false },
  { id: 'admission', title: 'Ketentuan masuk', body: EVENT.admission, unlockAt: null, placeholder: false },
  { id: 'dress-code', title: 'Busana', body: EVENT.dressCode, unlockAt: null, placeholder: false },
  { id: 'updates', title: 'Informasi terbaru', body: null, unlockAt: null, placeholder: true },
];

// Add photographs here once the committee provides permission and alt text.
export const gallery = [];

/** Parse a complete ISO instant with an explicit offset. Invalid dates fail closed. */
function parseInstant(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  if (typeof value === 'number') return Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) ? new Date(value) : null;
  if (typeof value !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '0', , sign, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHours = Number(offsetHourText || 0);
  const offsetMinutes = Number(offsetMinuteText || 0);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59 || offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) return null;

  // Date.UTC normalizes impossible dates, so check the calendar fields first.
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, Number(fraction.padEnd(3, '0')));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() + 1 !== month || calendar.getUTCDate() !== day) return null;
  const offset = (sign === '-' ? -1 : 1) * (offsetHours * 60 + offsetMinutes);
  return new Date(calendar.getTime() - offset * 60_000);
}

/**
 * Return current time, allowing a QA-only `?now=...` URL override. A malformed
 * query falls back to the real clock and never changes displayed HTML directly.
 */
export function getNow(search = typeof location === 'undefined' ? '' : location.search) {
  if (typeof search === 'string') {
    const value = new URLSearchParams(search).get('now');
    const override = parseInstant(value);
    if (override) return override;
  }
  return new Date();
}

/** @returns {'pra' | 'minggu-h' | 'live' | 'pasca'} */
export function getPhase(now = getNow()) {
  const instant = parseInstant(now) ?? getNow();
  const time = instant.getTime();
  const start = parseInstant(EVENT.start).getTime();
  const end = parseInstant(EVENT.end).getTime();
  if (time < start - 7 * 86_400_000) return 'pra';
  if (time < start) return 'minggu-h';
  if (time <= end) return 'live';
  return 'pasca';
}

/** Countdown to a full ISO instant; all values clamp to zero after it passes. */
export function getCountdown(now = getNow(), target = EVENT.start) {
  const current = parseInstant(now) ?? getNow();
  const destination = parseInstant(target);
  const totalMilliseconds = destination ? Math.max(0, destination.getTime() - current.getTime()) : 0;
  const wholeSeconds = Math.floor(totalMilliseconds / 1000);
  return {
    totalMilliseconds,
    days: Math.floor(wholeSeconds / 86_400),
    hours: Math.floor(wholeSeconds / 3_600) % 24,
    minutes: Math.floor(wholeSeconds / 60) % 60,
    seconds: wholeSeconds % 60,
    isComplete: totalMilliseconds === 0,
  };
}

/** ISO calendar date in Asia/Jakarta, independent of the visitor's time zone. */
export function getJakartaDate(now = getNow()) {
  const instant = parseInstant(now) ?? getNow();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EVENT.tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Unpublished sessions are excluded by default, including in live mode.
 * Pass `{ includePlaceholders: true }` only for local interface testing.
 */
export function getCurrentSession(now = getNow(), { includePlaceholders = false } = {}) {
  const instant = parseInstant(now) ?? getNow();
  const time = instant.getTime();
  const sessions = rundown.flatMap((day) => day.sessions.map((session) => ({ ...session, date: day.date })))
    .filter((session) => includePlaceholders || !session.placeholder)
    .sort((a, b) => parseInstant(a.start).getTime() - parseInstant(b.start).getTime());
  const current = sessions.find((session) => {
    const start = parseInstant(session.start)?.getTime();
    const end = parseInstant(session.end)?.getTime();
    return start <= time && time < end;
  }) ?? null;
  const next = sessions.find((session) => parseInstant(session.start)?.getTime() > time) ?? null;
  const previous = [...sessions].reverse().find((session) => parseInstant(session.end)?.getTime() <= time) ?? null;
  const duration = current ? parseInstant(current.end).getTime() - parseInstant(current.start).getTime() : 0;
  const progress = current && duration > 0 ? Math.min(1, Math.max(0, (time - parseInstant(current.start).getTime()) / duration)) : 0;
  return { current, next, previous, progress };
}

/** A final field opens immediately unless its release time is in the future. */
export function getEnvelopeState(envelope, now = getNow()) {
  if (!envelope || envelope.placeholder || !envelope.body) return 'sealed';
  if (!envelope.unlockAt) return 'open';
  const unlock = parseInstant(envelope.unlockAt);
  const instant = parseInstant(now) ?? getNow();
  return unlock && instant >= unlock ? 'open' : 'sealed';
}
