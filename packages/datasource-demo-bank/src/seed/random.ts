/* eslint-disable no-bitwise -- seeded random numbers and hashes */
/**
 * Deterministic randomness and dates: every generator draws from one seeded stream, so the data is
 * the same on every run; dates are relative to today, so a demo never looks stale.
 */
import { createHash } from 'crypto';

const SEED = 42;
const DAY = 24 * 3600 * 1000;
const TODAY = new Date(new Date().toISOString().slice(0, 10));
// The moment the bank's story stops: the start of the current hour, so every build within the
// same hour gives the same data, and nothing is ever dated after the real now.
const NOW = new Date(Math.floor(Date.now() / 3600000) * 3600000);

// ---- deterministic randomness --------------------------------------------------------------
function rng(start) {
  let a = start >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = rng(SEED);

// Names already given to a person or a company in this build: nobody shares one.
const taken = new Set();

/** Restart the stream: every build gives the same data. */
const reset = () => {
  rand = rng(SEED);
  taken.clear();
};

/**
 * Runs `build` on a stream of its own, seeded by `key`: what it draws never shifts the main stream,
 * so the data around it stays the same whatever it adds.
 */
function withStream(key, build) {
  const main = rand;
  let seed = 2166136261;
  [...key].forEach(c => {
    seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  });
  rand = rng(seed);

  try {
    return build();
  } finally {
    rand = main;
  }
}

/** The first of `candidates()` nobody has yet (or the last one tried), now taken. */
function uniqueName(candidates, tries = 60) {
  let name = candidates(0);
  for (let k = 1; k < tries && taken.has(name); k += 1) name = candidates(k);
  taken.add(name);

  return name;
}

const random = () => rand();
const pick = list => list[Math.floor(rand() * list.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
const chance = p => rand() < p;

const weighted = pairs => {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  const r = rand() * total;
  let reached = 0;
  const hit = pairs.find(([, w]) => {
    reached += w;

    return r < reached;
  });

  return (hit || pairs[pairs.length - 1])[0];
};

// UUID v4 drawn from the seeded generator: random-looking, yet identical on every run.
const uuid = () => {
  const hex = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');

  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

const daysAgo = n => new Date(TODAY.getTime() - n * DAY);
// SQLite has no date type: sequelize reads 'YYYY-MM-DD HH:MM:SS.SSS +00:00' but returns null for
// ISO strings ending in Z (it appends a timezone to them). The official demo has that bug.
const iso = d => d.toISOString().replace('T', ' ').replace('Z', ' +00:00');
// A business-hours time of day (07:00-20:59 UTC) on that day, so nothing happens at midnight.
const withTime = d =>
  new Date(d.getTime() + between(7 * 60, 21 * 60 - 1) * 60000 + between(0, 59999));
const isoDate = d => d.toISOString().slice(0, 10);

/** The day a person turns 18 (00:00 UTC), on the calendar: 18 × 365.25 days falls a day short. */
function eighteenth(person) {
  const d = new Date(`${person.date_of_birth}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 18);

  return d.getTime();
}

// ---- what an ID scan shows -------------------------------------------------------------------------
/**
 * The flaw an ID scan shows, fixed by its id (md5 of id + "flaw"), never drawn: render.ts draws it,
 * the simulated ID check (actions/onboarding.ts) reads it, crime.ts picks ids that show the flaw a
 * case needs. Most scans are clean; glare is a reflection that still passes.
 */
function scanFlaw(id) {
  const seed = parseInt(createHash('md5').update(`${id}flaw`).digest('hex').slice(0, 8), 16);

  return [...Array(7).fill('clean'), 'glare', 'cropped', 'name'][seed % 10];
}

// ---- the bank's working time: Paris, whatever the time zone of the machine --------------------------
const PARIS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
});
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A moment in Paris: { y, m, d, h, min, weekday } (weekday 0 = Monday). */
function parisParts(date) {
  const parts = Object.fromEntries(
    PARIS.formatToParts(new Date(date)).map(({ type, value }) => [type, value]),
  );

  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour),
    min: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** The moment it is `h:min` in Paris on day `d` of month `m` (days past the month roll over). */
function parisTime(y, m, d, h, min = 0, sec = 0) {
  const guess = Date.UTC(y, m - 1, d, h, min, sec);
  const p = parisParts(guess);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(guess / 60000) * 60000;

  return new Date(guess - offset);
}

/** Monday 00:00 in Paris of the week of `date`. */
function parisMonday(date) {
  const p = parisParts(date);

  return parisTime(p.y, p.m, p.d - p.weekday, 0);
}

const WORK_START = 8;
const WORK_END = 19;
const workday = p => p.weekday < 5;

/** The first working moment at or after `date`: Monday to Friday, 08:00-19:00 in Paris. */
function workMoment(date) {
  const p = parisParts(date);
  if (workday(p) && p.h >= WORK_START && p.h < WORK_END) return new Date(date);
  let day = p.h >= WORK_END || !workday(p) ? p.d + 1 : p.d;
  let next = parisParts(parisTime(p.y, p.m, day, 12));

  while (!workday(next)) {
    day += 1;
    next = parisParts(parisTime(p.y, p.m, day, 12));
  }

  return parisTime(p.y, p.m, day, WORK_START, between(0, 59), between(0, 59));
}

/** The last working moment at or before `date` (see workMoment). */
function workBefore(date) {
  const p = parisParts(date);
  if (workday(p) && p.h >= WORK_START && p.h < WORK_END) return new Date(date);
  let day = p.h < WORK_START || !workday(p) ? p.d - 1 : p.d;
  let prev = parisParts(parisTime(p.y, p.m, day, 12));

  while (!workday(prev)) {
    day -= 1;
    prev = parisParts(parisTime(p.y, p.m, day, 12));
  }

  return parisTime(p.y, p.m, day, WORK_END - 1, between(0, 59), between(0, 59));
}

/** `n` working days after `date` (a deadline counted in business days). */
function addWorkingDays(date, n) {
  const p = parisParts(date);
  let day = p.d;

  for (let left = n; left > 0; ) {
    day += 1;
    if (workday(parisParts(parisTime(p.y, p.m, day, 12)))) left -= 1;
  }

  return parisTime(p.y, p.m, day, p.h, p.min);
}

const round2 = n => Math.round(n * 100) / 100;
const ascii = s =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z-]/g, '');

export {
  addWorkingDays,
  eighteenth,
  scanFlaw,
  parisMonday,
  parisParts,
  parisTime,
  uniqueName,
  workBefore,
  workMoment,
  DAY,
  NOW,
  TODAY,
  ascii,
  between,
  chance,
  daysAgo,
  iso,
  isoDate,
  pick,
  random,
  reset,
  round2,
  uuid,
  weighted,
  withStream,
  withTime,
};
