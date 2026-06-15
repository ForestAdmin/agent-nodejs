/* eslint-disable no-console */
/**
 * Deterministic generator for the demo data shipped in `src/collections/*.ts`.
 *
 * It is a dev-only tool (NOT published — the package `files` field ships `dist`
 * only). Re-run it to refresh or rescale the demo dataset:
 *
 *   yarn workspace @forestadmin/datasource-demo-fintech generate
 *
 * A fixed PRNG seed makes the output fully reproducible, with no external
 * dependency. Dates are emitted as `daysAgo(n)` / `dayOnlyAgo(n)` calls so the
 * generated data always looks fresh at runtime (see `src/dates.ts`).
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

const OUT = join(__dirname, '..', 'src', 'collections');

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(42);
const randint = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const uniform = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const chance = (p: number) => rnd() < p;
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const round2 = (n: number) => Math.round(n * 100) / 100;

function choices<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i];
    if (r < 0) return items[i];
  }

  return items[items.length - 1];
}

function sample<T>(arr: T[], k: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.slice(0, k);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

// Raw TS expression to emit verbatim (e.g. a date helper call).
class Raw {
  constructor(public readonly expr: string) {}
}
const daysAgo = (n: number) => new Raw(`daysAgo(${n})`);
const hoursAgo = (n: number) => new Raw(`hoursAgo(${n})`);
const dayOnlyAgo = (n: number) => new Raw(`dayOnlyAgo(${n})`);

type Val = Raw | string | number | boolean | null;
type Row = Record<string, Val>;

// ── Pools ───────────────────────────────────────────────────────────────────
const FIRST = ['Emma','Lucas','Sofia','Liam','Mia','Noah','Olivia','Hugo','Léa','Jonas','Priya','Mateo','Ingrid','Youssef','Anna','Marco','Fatima','Erik','Chloé','Viktor','Aisha','Daniel','Elena','Tomas','Nadia','Pablo','Greta','Kemal','Sara','Andrei','Maja','Stefan','Camille','Dimitri','Zofia','Omar','Linnea','Rafael','Yara','Janusz','Beatriz','Henrik','Amara','Niko','Wei','Ravi','Sasha','Lena'];
const LAST = ['Johansson','Müller','Rossi','Dubois','Nowak','García','Andersen','Schneider','Kowalski','Ferretti','Sharma','Weber','Lindqvist','Haddad','Novak','Petrov','Bianchi','Mensah','Costa','Ahmadi','Berg','Romano','Fischer','Sørensen','Marchetti','Khan','Olsen','Demir','Vargas','Ivanov','Lefebvre','Kovač','Jensen','Moreau','Santos','Hassan','Eriksson','Lopez','Popescu','Wójcik'];
const COUNTRIES = ['DE','FR','SE','IT','ES','NL','PL','BE','DK','NO','FI','PT','AT','IE','CZ'];
const HIGH_RISK_COUNTRIES = ['RU','IR','SY','AF','MM','BY'];
const CITIES: Record<string, [string, string][]> = {
  DE: [['Berlin','10117'],['Munich','80331'],['Hamburg','20095']],
  FR: [['Paris','75001'],['Lyon','69001'],['Marseille','13001']],
  SE: [['Stockholm','11129'],['Gothenburg','41103']],
  IT: [['Milan','20121'],['Rome','00184']],
  ES: [['Madrid','28013'],['Barcelona','08001']],
  NL: [['Amsterdam','1011']], PL: [['Warsaw','00-001']], BE: [['Brussels','1000']],
  DK: [['Copenhagen','1050']], NO: [['Oslo','0150']], FI: [['Helsinki','00100']],
  PT: [['Lisbon','1100']], AT: [['Vienna','1010']], IE: [['Dublin','D01']], CZ: [['Prague','11000']],
  RU: [['Moscow','101000']], IR: [['Tehran','11369']], SY: [['Damascus','00963']],
  AF: [['Kabul','1001']], MM: [['Yangon','11181']], BY: [['Minsk','220000']],
};
const DIAL: Record<string, string> = {
  DE:'49',FR:'33',SE:'46',IT:'39',ES:'34',NL:'31',PL:'48',BE:'32',DK:'45',NO:'47',FI:'358',PT:'351',AT:'43',IE:'353',CZ:'420',
  RU:'7',IR:'98',SY:'963',AF:'93',MM:'95',BY:'375',
};
const STREETS = ['Hauptstraße','Rue de la Paix','Storgatan','Via Roma','Calle Mayor','Damrak','Marszałkowska','Rue Royale','Nørregade','Karl Johans gate','Mannerheimintie'];
const MERCHANTS: [string, string, string][] = [
  ['Amazon EU SARL','E-COMMERCE','5942'],['Spotify AB','STREAMING','4899'],['Steam (Valve)','DIGITAL_GOODS','5816'],['Wolt','FOOD_DELIVERY','5814'],['Uber BV','RIDESHARE','4121'],['Booking.com','TRAVEL','4722'],['Ryanair','AIRLINE','3000'],['MediaMarkt','ELECTRONICS','5732'],['Zalando SE','FASHION','5651'],['CryptoExchange XYZ','CRYPTO','6051'],['Netflix Intl','STREAMING','4899'],['Apple Distribution','DIGITAL_GOODS','5816'],['Carrefour','GROCERY','5411'],['Shell','FUEL','5541'],['IKEA','FURNITURE','5712'],['Glovo','FOOD_DELIVERY','5814'],['Binance','CRYPTO','6051'],['Decathlon','SPORTING','5941'],
];
const CB_REASONS: [string, string][] = [['4853','Cardholder Dispute — Services Not Provided'],['4831','Disputed Amount'],['10.4','Fraud — Card-Not-Present'],['10.5','Fraud — Card-Present Environment'],['13.1','Merchandise Not Received'],['12.6','Duplicate Processing'],['4837','No Cardholder Authorization']];
const CB_STATUS = ['INITIATED','PRESENTED','REPRESENTED','WON','LOST','PRE_ARBITRATION','ACCEPTED','ARBITRATION'];
const ANALYSTS = ['a.kowalski@neobank.eu','s.bauer@neobank.eu','m.rossi@neobank.eu','compliance@neobank.eu'];
const DOC_TYPES = ['PASSPORT','NATIONAL_ID','DRIVERS_LICENSE','PROOF_OF_ADDRESS','SELFIE','BANK_STATEMENT'];
const ATYPES = ['UNUSUAL_VOLUME','SUSPICIOUS_PATTERN','SANCTIONS_MATCH','HIGH_RISK_COUNTRY','RAPID_MOVEMENT','STRUCTURING'];
const REFUND_REASONS = ['DUPLICATE_CHARGE','SERVICE_NOT_RENDERED','ITEM_NOT_RECEIVED','UNAUTHORIZED','CANCELLED_ORDER'];
const SOURCES = ['CUSTOMER_DISPUTE','INTERNAL_DETECTION','MERCHANT_ALERT'];
const ACCENTS: Record<string, string> = { ø:'o', č:'c', š:'s', é:'e', ü:'u', ć:'c', ä:'a', ö:'o', å:'a' };
const deaccent = (s: string) => s.replace(/[øčšéüćäöå]/g, c => ACCENTS[c] ?? c);

// ── customers ───────────────────────────────────────────────────────────────
const N = 150;
const nHigh = Math.round(N * 0.2);
const nMed = Math.round(N * 0.33);
const riskPlan = shuffle([
  ...Array<string>(nHigh).fill('HIGH'),
  ...Array<string>(nMed).fill('MEDIUM'),
  ...Array<string>(N - nHigh - nMed).fill('LOW'),
]);
const ids = Array.from({ length: N }, (_, i) => i + 1);
const highIds = ids.filter(i => riskPlan[i - 1] === 'HIGH');
const elevatedIds = ids.filter(i => ['HIGH', 'MEDIUM'].includes(riskPlan[i - 1]));
const sanctionedIds = new Set(sample(highIds, Math.max(2, Math.round(N * 0.035))));
const pepIds = new Set(sample(elevatedIds, Math.max(4, Math.round(N * 0.08))));

interface Customer extends Row { _risk: string; }
const customers: Customer[] = [];
const seenEmails = new Set<string>();
for (let i = 1; i <= N; i += 1) {
  const fn = FIRST[(i - 1) % FIRST.length];
  const ln = LAST[(i * 7) % LAST.length];
  const risk = riskPlan[i - 1];
  const sanctioned = sanctionedIds.has(i);
  const pep = pepIds.has(i);

  let cor: string;
  let onb: string;
  if (risk === 'HIGH') {
    cor = chance(0.5) ? pick(HIGH_RISK_COUNTRIES) : pick(COUNTRIES);
    onb = pick(['APPROVED', 'PENDING_REVIEW', 'REJECTED']);
  } else if (risk === 'MEDIUM') {
    cor = pick(COUNTRIES);
    onb = pick(['APPROVED', 'APPROVED', 'PENDING_REVIEW']);
  } else {
    cor = pick(COUNTRIES);
    onb = pick(['APPROVED', 'APPROVED', 'APPROVED', 'STARTED']);
  }
  if (sanctioned) onb = pick(['REJECTED', 'PENDING_REVIEW']); // never clears onboarding

  const country = CITIES[cor] ? cor : pick(COUNTRIES);
  const [city, postal] = pick(CITIES[country]);
  const created = randint(60, 220);

  const slug = deaccent(`${fn.toLowerCase()}.${ln.toLowerCase()}`);
  let email = `${slug}@example.com`;
  if (seenEmails.has(email)) email = `${slug}${i}@example.com`; // names repeat at scale
  seenEmails.add(email);

  customers.push({
    id: i, first_name: fn, last_name: ln, email,
    phone: `+${DIAL[cor] ?? '33'} ${randint(600, 799)} ${randint(100000, 999999)}`,
    date_of_birth: `${randint(1962, 2003)}-${String(randint(1, 12)).padStart(2, '0')}-${String(randint(1, 28)).padStart(2, '0')}`,
    nationality: pick(COUNTRIES), country_of_residence: cor,
    address_line1: `${pick(STREETS)} ${randint(1, 180)}`,
    address_line2: chance(0.8) ? null : `Apt ${randint(1, 40)}`,
    city, postal_code: postal, country,
    onboarding_status: onb, risk_rating: risk,
    is_pep: pep, is_sanctioned: sanctioned,
    referral_code: chance(0.7) ? null : `REF${randint(1000, 9999)}`,
    created_at: daysAgo(created), updated_at: daysAgo(randint(1, Math.max(2, created - 10))),
    _risk: risk,
  });
}

// ── cards (>=1 per customer) ────────────────────────────────────────────────
const cards: Row[] = [];
const cardsByCust: Record<number, Row[]> = {};
let cid = 0;
for (const c of customers) {
  const n = randint(1, 3);
  for (let k = 0; k < n; k += 1) {
    cid += 1;
    const st = choices(['ACTIVE', 'BLOCKED', 'EXPIRED', 'PENDING', 'CANCELLED'], [70, 11, 8, 7, 4]);
    const issued = randint(20, 380);
    const rec: Row = {
      id: cid, customer_id: c.id as number,
      card_type: choices(['VIRTUAL', 'PHYSICAL'], [55, 45]),
      status: st, last_four_digits: String(randint(0, 9999)).padStart(4, '0'),
      issued_at: daysAgo(issued), expires_at: dayOnlyAgo(-randint(365, 1460)),
      blocked_reason: null, blocked_at: null,
    };
    if (st === 'BLOCKED') {
      rec.blocked_reason = pick(['Suspected fraud', 'Reported lost', 'Compliance hold', 'Customer request']);
      rec.blocked_at = daysAgo(randint(1, Math.max(2, issued - 5)));
    }
    cards.push(rec);
    (cardsByCust[c.id as number] ||= []).push(rec);
  }
}

// ── kyc cases + documents ───────────────────────────────────────────────────
const kycCases: Row[] = [];
const docs: Row[] = [];
let kid = 0;
let did = 0;
for (const c of customers) {
  const ncases = chance(0.85) ? 1 : 2;
  for (let k = 0; k < ncases; k += 1) {
    kid += 1;
    let st: string;
    if (c.is_sanctioned) st = pick(['ESCALATED', 'REJECTED']);
    else if (c.is_pep) st = pick(['ESCALATED', 'IN_REVIEW', 'PENDING_APPROVAL']);
    else if (c.onboarding_status === 'APPROVED') st = pick(['APPROVED', 'APPROVED', 'IN_REVIEW']);
    else if (c.onboarding_status === 'REJECTED') st = 'REJECTED';
    else if (c._risk === 'HIGH') st = pick(['ESCALATED', 'IN_REVIEW', 'PENDING_APPROVAL']);
    else st = pick(['IN_REVIEW', 'PENDING_APPROVAL', 'OPEN']);
    const opened = randint(30, 210);
    kycCases.push({
      id: kid, customer_id: c.id as number, status: st,
      opened_at: daysAgo(opened),
      resolved_at: ['APPROVED', 'REJECTED'].includes(st) ? daysAgo(randint(1, Math.max(2, opened - 10))) : null,
      rejection_reason: st === 'REJECTED' ? pick(['Document mismatch', 'Failed liveness check', 'Sanctions concern']) : null,
      escalation_reason: st === 'ESCALATED' ? pick(['PEP match requires senior review', 'High-risk jurisdiction', 'Adverse media hit']) : null,
      notes: chance(0.5) ? null : pick(['Awaiting proof of address.', 'Customer responsive.', 'Second review scheduled.', 'Source of funds requested.']),
    });
    for (const dt of sample(DOC_TYPES, randint(2, 5))) {
      did += 1;
      const verified = st === 'APPROVED' || chance(0.5);
      const up = randint(1, Math.max(2, opened - 2));
      docs.push({
        id: did, kyc_case_id: kid, customer_id: c.id as number,
        document_type: dt, file_url: `https://kyc.neobank.eu/docs/${c.id}/${dt.toLowerCase()}.pdf`,
        uploaded_at: daysAgo(up), verified, verified_at: verified ? daysAgo(randint(1, up)) : null,
      });
    }
  }
}

// ── aml alerts ──────────────────────────────────────────────────────────────
const weights = customers.map(c => {
  let w = { HIGH: 6, MEDIUM: 2, LOW: 1 }[c._risk as 'HIGH' | 'MEDIUM' | 'LOW'];
  if (c.is_pep) w += 4;
  if (c.is_sanctioned) w += 8;

  return w;
});
function amlSeverity(risk: string, sanctioned: boolean, atype: string): string {
  if (sanctioned || atype === 'SANCTIONS_MATCH') return choices(['HIGH', 'CRITICAL'], [40, 60]);

  return choices(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    { HIGH: [0, 1, 5, 4], MEDIUM: [1, 5, 3, 1], LOW: [6, 3, 1, 0] }[risk as 'HIGH' | 'MEDIUM' | 'LOW']);
}
interface Alert extends Row { _sar_ref: string | null; }
const alerts: Alert[] = [];
let sarSeq = 0;
for (let aid = 1; aid <= 70; aid += 1) {
  const c = choices(customers, weights);
  let atype: string;
  if (c.is_sanctioned) atype = chance(0.7) ? 'SANCTIONS_MATCH' : pick(ATYPES);
  else atype = chance(0.08) ? 'SANCTIONS_MATCH' : pick(ATYPES.filter(t => t !== 'SANCTIONS_MATCH'));
  const st = choices(['OPEN', 'IN_REVIEW', 'CLEARED', 'ESCALATED'], [30, 28, 22, 20]);
  const trig = randint(1, 130);
  let sarRef: string | null = null;
  if (st === 'ESCALATED' && (c._risk === 'HIGH' || c.is_sanctioned || chance(0.5))) {
    sarSeq += 1;
    sarRef = `SAR-2026-${String(sarSeq).padStart(5, '0')}`;
  }
  const resolved = ['CLEARED', 'ESCALATED'].includes(st);
  alerts.push({
    id: aid, customer_id: c.id as number,
    alert_type: atype, severity: amlSeverity(c._risk as string, c.is_sanctioned as boolean, atype), status: st,
    triggered_at: daysAgo(trig),
    resolution_notes: st === 'CLEARED' ? pick(['False positive — name overlap.', 'Cleared after review.'])
      : st === 'ESCALATED' ? pick(['Escalated to MLRO.', 'Under enhanced due diligence.']) : null,
    sar_reference: sarRef,
    resolved_at: resolved ? daysAgo(randint(1, Math.max(2, trig - 1))) : null,
    _sar_ref: sarRef,
  });
}

// ── sar reports (from escalated alerts) ─────────────────────────────────────
const sars: Row[] = [];
let sid = 0;
for (const a of alerts.filter(x => x._sar_ref)) {
  sid += 1;
  const start = randint(40, 120);
  const end = randint(5, 35);
  sars.push({
    id: sid, alert_id: a.id as number, customer_id: a.customer_id as number,
    reference: a._sar_ref as string,
    status: choices(['DRAFT', 'SUBMITTED', 'FILED'], [25, 25, 50]),
    activity_type: a.alert_type as string,
    activity_start_date: dayOnlyAgo(start), activity_end_date: dayOnlyAgo(end),
    total_amount: round2(uniform(8000, 240000)), transaction_count: randint(3, 80),
    narrative: `Suspicious activity consistent with ${(a.alert_type as string).replace(/_/g, ' ').toLowerCase()} detected over ${start - end} days; cumulative value exceeds internal thresholds. Funds movement reviewed by compliance and escalated to the financial intelligence unit.`,
    filed_at: chance(0.6) ? daysAgo(randint(1, end)) : null,
    created_at: daysAgo(end + randint(1, 5)),
  });
}

// Coherence: an alert with a linked SAR reflects that SAR's state.
const alertById = new Map(alerts.map(a => [a.id as number, a]));
for (const s of sars) {
  const a = alertById.get(s.alert_id as number)!;
  if (['FILED', 'SUBMITTED'].includes(s.status as string)) {
    a.status = 'SAR_FILED';
    a.resolved_at = a.resolved_at || s.filed_at || s.created_at;
    a.resolution_notes = `SAR ${s.reference} filed with the FIU.`;
  } else {
    a.status = 'ESCALATED';
  }
}

// ── refund requests ─────────────────────────────────────────────────────────
const refunds: Row[] = [];
const refundsByCust: Record<number, Row[]> = {};
for (let rid = 1; rid <= 55; rid += 1) {
  const c = pick(customers);
  const txdate = randint(10, 90);
  const st = choices(['PENDING', 'APPROVED', 'DECLINED', 'ESCALATED'], [30, 35, 20, 15]);
  const rec: Row = {
    id: rid, reference: `RR-2026-${String(rid).padStart(5, '0')}`, customer_id: c.id as number,
    transaction_id: `TXN-${randint(10000, 99999)}`, transaction_date: dayOnlyAgo(txdate),
    requested_at: daysAgo(txdate - randint(1, 5)),
    amount: round2(uniform(9, 1200)), currency: 'EUR',
    reason: pick(REFUND_REASONS),
    reason_detail: chance(0.5) ? null : pick(['Charged twice for one order.', 'Subscription not delivered.', 'Parcel never arrived.', 'Card used without consent.']),
    status: st,
    reviewed_at: st !== 'PENDING' ? daysAgo(randint(1, Math.max(2, txdate - 3))) : null,
    reviewed_by: st !== 'PENDING' ? pick(ANALYSTS) : null,
    resolution_notes: st === 'PENDING' ? null : pick(['Refunded to source.', 'Declined — merchant evidence.', 'Escalated to chargeback.', 'Approved as goodwill.']),
    escalated_to: st === 'ESCALATED' ? 'chargebacks' : null,
    created_at: daysAgo(txdate - randint(0, 4)),
  };
  refunds.push(rec);
  (refundsByCust[c.id as number] ||= []).push(rec);
}

// ── chargebacks (spread, not dominant) ──────────────────────────────────────
const chargebacks: Row[] = [];
let cbid = 0;
const cbCusts = sample(customers, 60);
const plan: Customer[] = [];
for (const c of cbCusts) for (let k = 0; k < choices([1, 2, 3, 5], [46, 30, 17, 7]); k += 1) plan.push(c);
for (const c of shuffle(plan)) {
  cbid += 1;
  const [merch, cat, mcc] = pick(MERCHANTS);
  const card = pick(cardsByCust[c.id as number]);
  const txAmount = round2(uniform(12, 2400));
  const amount = chance(0.35) ? round2(txAmount * uniform(0.2, 0.9)) : txAmount; // partial disputes
  const status = choices(CB_STATUS, [22, 16, 13, 13, 5, 5, 3, 3]);
  const filed = randint(1, 110);
  const [rcode, rdesc] = pick(CB_REASONS);
  const src = choices(SOURCES, [55, 30, 15]);
  let rr: number | null = null;
  if (src === 'CUSTOMER_DISPUTE' && refundsByCust[c.id as number] && chance(0.4)) {
    rr = pick(refundsByCust[c.id as number]).id as number;
  }
  const decided = ['WON', 'LOST', 'ACCEPTED'].includes(status);
  const presented = ['PRESENTED', 'REPRESENTED', 'WON', 'LOST', 'ARBITRATION', 'PRE_ARBITRATION'].includes(status);
  chargebacks.push({
    id: cbid, reference: `CB-2026-${String(cbid).padStart(5, '0')}`, customer_id: c.id as number, card_id: card.id as number,
    refund_request_id: rr, transaction_id: `TXN-${randint(10000, 99999)}`,
    merchant_name: merch, merchant_category: cat, mcc_code: mcc,
    transaction_amount: txAmount, transaction_currency: 'EUR', transaction_date: dayOnlyAgo(filed + randint(2, 20)),
    amount, currency: 'EUR', network: pick(['VISA', 'MASTERCARD']),
    reason_code: rcode, reason_description: rdesc, source: src,
    processor_dispute_id: chance(0.7) ? `ADYEN-DSP-${randint(100000, 999999)}` : null,
    status, filed_at: daysAgo(filed), representment_deadline: daysAgo(filed - 30),
    decision_at: decided ? daysAgo(randint(1, Math.max(2, filed - 2))) : null,
    evidence_url: presented && chance(0.7) ? `https://disputes.neobank.eu/evidence/${cbid}.zip` : null,
    evidence_submitted_at: presented && chance(0.7) ? daysAgo(randint(1, Math.max(2, filed - 1))) : null,
    provisional_credit_issued: chance(0.4),
    analyst_email: chance(0.6) ? pick(ANALYSTS) : null,
    resolution_notes: decided ? pick(['Won at representment.', 'Lost — insufficient evidence.', 'Accepted liability.', 'Pending issuer response.']) : null,
    created_at: daysAgo(filed > 2 ? filed : 1), updated_at: daysAgo(randint(0, Math.max(1, filed - 1))),
  });
}

// ── schemas (field, columnType, enumValues|null) — pk is always `id` ─────────
type Field = [string, string, string[] | null];
const E = {
  onboarding: ['STARTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'],
  risk: ['LOW', 'MEDIUM', 'HIGH'],
  cardType: ['VIRTUAL', 'PHYSICAL'],
  cardStatus: ['ACTIVE', 'BLOCKED', 'CANCELLED', 'PENDING', 'EXPIRED'],
  kyc: ['OPEN', 'IN_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ESCALATED'],
  doc: ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'PROOF_OF_ADDRESS', 'SELFIE', 'BANK_STATEMENT'],
};
const SCHEMAS: Record<string, Field[]> = {
  customers: [['id','Number',null],['first_name','String',null],['last_name','String',null],['email','String',null],['phone','String',null],['date_of_birth','Dateonly',null],['nationality','String',null],['country_of_residence','String',null],['address_line1','String',null],['address_line2','String',null],['city','String',null],['postal_code','String',null],['country','String',null],['onboarding_status','Enum',E.onboarding],['risk_rating','Enum',E.risk],['is_pep','Boolean',null],['is_sanctioned','Boolean',null],['referral_code','String',null],['created_at','Date',null],['updated_at','Date',null]],
  cards: [['id','Number',null],['customer_id','Number',null],['card_type','Enum',E.cardType],['status','Enum',E.cardStatus],['last_four_digits','String',null],['issued_at','Date',null],['expires_at','Dateonly',null],['blocked_reason','String',null],['blocked_at','Date',null]],
  aml_alerts: [['id','Number',null],['customer_id','Number',null],['alert_type','Enum',ATYPES],['severity','String',null],['status','String',null],['triggered_at','Date',null],['resolution_notes','String',null],['sar_reference','String',null],['resolved_at','Date',null]],
  kyc_cases: [['id','Number',null],['customer_id','Number',null],['status','Enum',E.kyc],['opened_at','Date',null],['resolved_at','Date',null],['rejection_reason','String',null],['escalation_reason','String',null],['notes','String',null]],
  kyc_documents: [['id','Number',null],['kyc_case_id','Number',null],['customer_id','Number',null],['document_type','Enum',E.doc],['file_url','String',null],['uploaded_at','Date',null],['verified','Boolean',null],['verified_at','Date',null]],
  chargebacks: [['id','Number',null],['reference','String',null],['customer_id','Number',null],['card_id','Number',null],['refund_request_id','Number',null],['transaction_id','String',null],['merchant_name','String',null],['merchant_category','String',null],['mcc_code','String',null],['transaction_amount','Number',null],['transaction_currency','String',null],['transaction_date','Dateonly',null],['amount','Number',null],['currency','String',null],['network','String',null],['reason_code','String',null],['reason_description','String',null],['source','String',null],['processor_dispute_id','String',null],['status','String',null],['filed_at','Date',null],['representment_deadline','Date',null],['decision_at','Date',null],['evidence_url','String',null],['evidence_submitted_at','Date',null],['provisional_credit_issued','Boolean',null],['analyst_email','String',null],['resolution_notes','String',null],['created_at','Date',null],['updated_at','Date',null]],
  refund_requests: [['id','Number',null],['reference','String',null],['customer_id','Number',null],['transaction_id','String',null],['transaction_date','Dateonly',null],['requested_at','Date',null],['amount','Number',null],['currency','String',null],['reason','String',null],['reason_detail','String',null],['status','String',null],['reviewed_at','Date',null],['reviewed_by','String',null],['resolution_notes','String',null],['escalated_to','String',null],['created_at','Date',null]],
  sar_reports: [['id','Number',null],['alert_id','Number',null],['customer_id','Number',null],['reference','String',null],['status','String',null],['activity_type','String',null],['activity_start_date','Dateonly',null],['activity_end_date','Dateonly',null],['total_amount','Number',null],['transaction_count','Number',null],['narrative','String',null],['filed_at','Date',null],['created_at','Date',null]],
};
const PASCAL: Record<string, string> = { customers:'Customers', cards:'Cards', aml_alerts:'AmlAlerts', kyc_cases:'KycCases', kyc_documents:'KycDocuments', chargebacks:'Chargebacks', refund_requests:'RefundRequests', sar_reports:'SarReports' };
const FILE: Record<string, string> = { customers:'customers', cards:'cards', aml_alerts:'aml-alerts', kyc_cases:'kyc-cases', kyc_documents:'kyc-documents', chargebacks:'chargebacks', refund_requests:'refund-requests', sar_reports:'sar-reports' };
const DATA: Record<string, Row[]> = { customers, cards, aml_alerts: alerts, kyc_cases: kycCases, kyc_documents: docs, chargebacks, refund_requests: refunds, sar_reports: sars };

// ── emission ────────────────────────────────────────────────────────────────
function ts(v: Val): string {
  if (v instanceof Raw) return v.expr;
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);

  return JSON.stringify(v);
}

function emit(table: string): number {
  const fields = SCHEMAS[table];
  const fieldNames = fields.map(f => f[0]);

  const schemaBlock = fields.map(([name, type, enumValues]) => {
    const lines = [`    ${JSON.stringify(name)}: {`, "      type: 'Column',", `      columnType: '${type}',`];
    if (enumValues) lines.push(`      enumValues: [${enumValues.map(e => JSON.stringify(e)).join(', ')}],`);
    if (name === 'id') lines.push('      isPrimaryKey: true,');
    lines.push('    },');

    return lines.join('\n');
  }).join('\n');

  const used = new Set<string>();
  const recordsBlock = DATA[table].map(row => {
    const kv = fieldNames.map(k => {
      const v = row[k];
      if (v instanceof Raw) used.add(v.expr.split('(')[0]);

      return `      ${JSON.stringify(k)}: ${ts(v)}`;
    }).join(',\n');

    return `    {\n${kv},\n    }`;
  }).join(',\n');

  const dateImport = used.size ? `\nimport { ${[...used].sort().join(', ')} } from '../dates';` : '';
  const cls = `${PASCAL[table]}Collection`;
  const content = `import type { DataSource, FieldSchema, RecordData } from '@forestadmin/datasource-toolkit';

import BaseFintechCollection from './base';${dateImport}

export default class ${cls} extends BaseFintechCollection {
  private static schema: Record<string, FieldSchema> = {
${schemaBlock}
  };

  protected override records: RecordData[] = [
${recordsBlock},
  ];

  constructor(datasource: DataSource) {
    super(datasource, ${JSON.stringify(table)}, ${cls}.schema);
  }
}
`;
  writeFileSync(join(OUT, `${FILE[table]}.ts`), content);

  return DATA[table].length;
}

for (const table of Object.keys(SCHEMAS)) {
  console.log(`  ${FILE[table]}.ts  (${emit(table)} records)`);
}
console.log('Done. Run `yarn build && yarn lint --fix` in the package to format the output.');
