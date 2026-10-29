/**
 * Public event content and time rules. An empty field means the committee has
 * not published it yet. Placeholder schedule entries exist only to exercise
 * the interface; public views should keep them sealed until real data lands.
 */
export const EVENT = {
  title: 'BHARASENA',
  subtitle: 'Prom Night Batalyon 6',
  battalion: 'Batalyon Bhara Arsa Nawasena',
  school: 'SMAN 2 Taruna Bhayangkara',
  guestArtist: 'Budi Doremi',
  tz: 'Asia/Jakarta',
  dateStart: '2026-12-11',
  dateEnd: '2026-12-13',
  dateLabel: '11–13 Desember 2026',
  // The event dates are known; these opening and closing hours are examples.
  start: '2026-12-11T16:00:00+07:00',
  end: '2026-12-13T22:00:00+07:00',
  timePlaceholder: true,
  venue: 'SMA Negeri 2 Taruna Bhayangkara Jawa Timur, Jl. Pandan, Desa Kembiritan, Kecamatan Genteng, Kabupaten Banyuwangi.',
  artistAt: null,
  dressCode: null,
  admission: 'Hadir untuk seluruh anggota SMAN 2 Taruna Bhayangkara dan tamu tertentu yang diundang. Parkir dan konsumsi tersedia. Yang wajib dibawa: menyusul. Tiket/kartu identitas/undangan: menyusul. Aturan masuk, keterlambatan, dan barang terlarang: menyusul.',
  contact: null,
  showPlaceholderHints: false,
};

// Session titles and hours are sample data, never an announced program.
export const rundown = [
  {
    date: '2026-12-11',
    label: '11 Desember',
    weekday: 'Jumat',
    sessions: [
      { start: '2026-12-11T16:00:00+07:00', end: '2026-12-11T18:00:00+07:00', title: 'Sesi 1', desc: null, placeholder: true },
      { start: '2026-12-11T18:00:00+07:00', end: '2026-12-11T20:00:00+07:00', title: 'Sesi 2', desc: null, placeholder: true },
      { start: '2026-12-11T20:00:00+07:00', end: '2026-12-11T22:00:00+07:00', title: 'Sesi 3', desc: null, placeholder: true },
    ],
  },
  {
    date: '2026-12-12',
    label: '12 Desember',
    weekday: 'Sabtu',
    sessions: [
      { start: '2026-12-12T09:00:00+07:00', end: '2026-12-12T13:00:00+07:00', title: 'Sesi 1', desc: null, placeholder: true },
      { start: '2026-12-12T13:00:00+07:00', end: '2026-12-12T18:00:00+07:00', title: 'Sesi 2', desc: null, placeholder: true },
      { start: '2026-12-12T18:00:00+07:00', end: '2026-12-12T22:00:00+07:00', title: 'Sesi 3', desc: null, placeholder: true },
    ],
  },
  {
    date: '2026-12-13',
    label: '13 Desember',
    weekday: 'Minggu',
    sessions: [
      { start: '2026-12-13T09:00:00+07:00', end: '2026-12-13T13:00:00+07:00', title: 'Sesi 1', desc: null, placeholder: true },
      { start: '2026-12-13T13:00:00+07:00', end: '2026-12-13T18:00:00+07:00', title: 'Sesi 2', desc: null, placeholder: true },
      { start: '2026-12-13T18:00:00+07:00', end: '2026-12-13T22:00:00+07:00', title: 'Sesi 3', desc: null, placeholder: true },
    ],
  },
];

// Keep body null while sealed. Shipping unreleased details in a static bundle
// would expose them regardless of what the interface displays.
export const envelopes = [
  { id: 'venue', title: 'Lokasi', body: null, unlockAt: null, placeholder: true },
  { id: 'admission', title: 'Ketentuan masuk', body: null, unlockAt: null, placeholder: true },
  { id: 'dress-code', title: 'Busana', body: null, unlockAt: null, placeholder: true },
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
