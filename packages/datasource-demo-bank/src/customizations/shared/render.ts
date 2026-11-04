/**
 * KYC documents drawn on the fly as PDFs, so the file viewer in Forest shows what a reviewer would
 * see. Every file is a specimen built from the record's own data: no real document, no real face.
 *
 * A document waiting for review is clean most of the time, now and then with a reason to look
 * twice (glare on the number, a cut-off scan, a name spelled differently, a bill addressed to
 * someone else, articles nobody signed); a failed one shows why it failed, a forged one the patch
 * pasted over it. The same document always looks the same.
 */
import crypto from 'crypto';

import { scanFlaw } from '../../seed/random';

// ---- a tiny PDF writer: rectangles, ellipses, curves and text, Helvetica and Courier ----------

const WIN_ANSI = {
  '’': 0x92,
  '‘': 0x91,
  '“': 0x93,
  '”': 0x94,
  '–': 0x96,
  '—': 0x97,
  '€': 0x80,
  œ: 0x9c,
};

function encode(text) {
  const bytes = [...String(text ?? '')].map(c => {
    const code = c.charCodeAt(0);
    if (WIN_ANSI[c]) return WIN_ANSI[c];

    return code < 256 ? code : 63;
  });

  return Buffer.from(bytes)
    .toString('latin1')
    .replace(/[\\()]/g, c => `\\${c}`);
}

const rgb = hex =>
  [1, 3, 5].map(i => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');

// The same drawing as SVG, for a picture in a web page (the Onboarding desk's document preview).
const SVG_FONTS = {
  F1: 'font-family="Helvetica, Arial, sans-serif"',
  F2: 'font-family="Helvetica, Arial, sans-serif" font-weight="bold"',
  F3: 'font-family="Courier New, Courier, monospace"',
};
const xml = text =>
  String(text ?? '').replace(
    /[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]),
  );
const num = n => +Number(n).toFixed(2);

/** One page, drawn twice as it goes: PDF operators (ops) and SVG elements (svg). */
class Page {
  width;

  height;

  ops;

  svg;

  clips;

  constructor(width, height) {
    Object.assign(this, { width, height, ops: [], svg: [], clips: 0 });
  }

  rect(x, y, w, h, fill, stroke?) {
    const box = `${x} ${this.height - y - h} ${w} ${h} re`;
    if (fill) this.ops.push(`${rgb(fill)} rg ${box} f`);
    if (stroke) this.ops.push(`${rgb(stroke)} RG 0.8 w ${box} S`);
    this.svg.push(
      `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${
        fill || 'none'
      }"${stroke ? ` stroke="${stroke}" stroke-width="0.8"` : ''}/>`,
    );

    return this;
  }

  ellipse(cx, cy, rx, ry, fill, alpha) {
    const k = 0.5523;
    const y = this.height - cy;
    const [ox, oy] = [rx * k, ry * k];
    this.ops.push(
      `q ${alpha ? '/Glare gs ' : ''}${rgb(fill)} rg ${cx - rx} ${y} m ` +
        `${cx - rx} ${y + oy} ${cx - ox} ${y + ry} ${cx} ${y + ry} c ` +
        `${cx + ox} ${y + ry} ${cx + rx} ${y + oy} ${cx + rx} ${y} c ` +
        `${cx + rx} ${y - oy} ${cx + ox} ${y - ry} ${cx} ${y - ry} c ` +
        `${cx - ox} ${y - ry} ${cx - rx} ${y - oy} ${cx - rx} ${y} c f Q`,
    );
    this.svg.push(
      `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}" fill="${fill}"${
        alpha ? ' opacity="0.88"' : ''
      }/>`,
    );

    return this;
  }

  /** Everything drawn until `unclip()` stays inside the box. */
  clip(x, y, w, h) {
    this.ops.push(`q ${x} ${this.height - y - h} ${w} ${h} re W n`);
    this.clips += 1;
    const id = `clip${this.clips}`;
    this.svg.push(
      `<clipPath id="${id}"><rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(
        h,
      )}"/></clipPath><g clip-path="url(#${id})">`,
    );

    return this;
  }

  unclip() {
    this.ops.push('Q');
    this.svg.push('</g>');

    return this;
  }

  /** A pen stroke through the points (a signature). */
  scribble(points, color) {
    const [first, ...rest] = points.map(([x, y]) => `${x} ${this.height - y}`);
    this.ops.push(`${rgb(color)} RG 1.2 w ${first} m ${rest.map(p => `${p} l`).join(' ')} S`);
    this.svg.push(
      `<polyline points="${points
        .map(([x, y]) => `${num(x)},${num(y)}`)
        .join(' ')}" fill="none" stroke="${color}" stroke-width="1.2"/>`,
    );

    return this;
  }

  text(
    x,
    y,
    value,
    {
      size = 10,
      font = 'F1',
      color = '#111827',
      angle = 0,
      alpha,
    }: { size?; font?; color?; angle?; alpha? } = {},
  ) {
    const [c, s] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)];
    const matrix = [c, s, -s, c, x, this.height - y].map(n => +n.toFixed(3)).join(' ');
    this.ops.push(
      `q ${alpha ? '/Faint gs ' : ''}BT /${font} ${size} Tf ${rgb(color)} rg ${matrix} Tm ` +
        `(${encode(value)}) Tj ET Q`,
    );
    // PDF turns counterclockwise with y up; SVG has y down, so the angle changes sign.
    const turn = angle ? ` transform="rotate(${num(-angle)} ${num(x)} ${num(y)})"` : '';
    this.svg.push(
      `<text x="${num(x)}" y="${num(y)}" font-size="${size}" ${SVG_FONTS[font]} fill="${color}"${
        alpha ? ' opacity="0.16"' : ''
      }${turn}>${xml(value)}</text>`,
    );

    return this;
  }
}

/** The page as an SVG picture, on white like the PDF. */
function svg(page) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.width} ${page.height}" ` +
    `width="${page.width}" height="${page.height}" xml:space="preserve">` +
    `<rect width="${page.width}" height="${page.height}" fill="#ffffff"/>${page.svg.join('')}</svg>`
  );
}

function pdf(page) {
  const body = page.ops.join('\n');
  const fonts = { F1: 'Helvetica', F2: 'Helvetica-Bold', F3: 'Courier' };
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Contents 4 0 R ` +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> ' +
      '/ExtGState << /Glare << /ca 0.88 >> /Faint << /ca 0.16 >> >> >> >>',
    `<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`,
    ...Object.values(fonts).map(
      font => `<< /Type /Font /Subtype /Type1 /BaseFont /${font} /Encoding /WinAnsiEncoding >>`,
    ),
  ];
  let out = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const offset = Buffer.byteLength(out, 'latin1');
    out += `${i + 1} 0 obj\n${object}\nendobj\n`;

    return offset;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(out, 'latin1');
}

// ---- what every document shares ------------------------------------------------------------------

/** A number from the record's id, so a document never changes between two views. */
const seeded = (id, salt = '') =>
  parseInt(crypto.createHash('md5').update(`${id}${salt}`).digest('hex').slice(0, 8), 16);
const choose = (id, list, salt) => list[seeded(id, salt) % list.length];

const day = value => (value ? String(value).slice(0, 10).split('-').reverse().join('/') : '');
const money = n => `${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })} EUR`;
const fullName = p => `${p.first_name || ''} ${p.last_name || ''}`.trim();
const addressLines = p => [p.address_line1 || '', `${p.postal_code || ''} ${p.city || ''}`.trim()];

function specimen(page) {
  const size = Math.round(page.width / 7);
  page.text(page.width * 0.18, page.height * 0.62, 'SPECIMEN', {
    size,
    font: 'F2',
    color: '#dc2626',
    angle: 24,
    alpha: true,
  });
}

/** Head and shoulders, drawn: the look follows the person, a mismatching selfie gets another. */
function portrait(page, x, y, w, h, look) {
  const skin = ['#e8c4a0', '#c99a6e', '#8d5a3b', '#f1d3b8'][look % 4];
  const hair = ['#2b1d14', '#6b4423', '#b88b4a', '#1f2937', '#9ca3af'][look % 5];
  const cx = x + w / 2;
  page.clip(x, y, w, h);
  page.rect(x, y, w, h, '#dbe3ea');
  if (look % 3 === 0) page.rect(cx - w * 0.3, y + h * 0.2, w * 0.6, h * 0.55, hair);
  page.ellipse(cx, y + h * 1.02, w * 0.48, h * 0.32, ['#334155', '#7c2d12', '#065f46'][look % 3]);
  page.ellipse(cx, y + h * 0.38, w * 0.27, h * 0.25, hair);
  page.ellipse(cx, y + h * 0.45, w * 0.22, h * 0.2, skin);
  page.unclip();
}

// ---- identity documents ----------------------------------------------------------------------------

const ID_STYLE = {
  NATIONAL_ID: ['IDENTITY CARD', '#dbeafe', '#1e3a8a', 'ID'],
  DRIVERS_LICENSE: ['DRIVING LICENCE', '#fce7f3', '#9d174d', 'DL'],
  PASSPORT: ['PASSPORT', '#fee2e2', '#7f1d1d', 'P'],
};
const ISO3 = {
  FR: 'FRA',
  DE: 'DEU',
  ES: 'ESP',
  IT: 'ITA',
  BE: 'BEL',
  PT: 'PRT',
  PL: 'POL',
  RO: 'ROU',
  NL: 'NLD',
};
const mrzName = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[^A-Za-z0-9]/g, '<')
    .toUpperCase();
const yymmdd = value =>
  String(value || '')
    .slice(2, 10)
    .replace(/-/g, '');

/** "Fournier" read as "Fourrnier": one letter doubled. */
function misspelt(name) {
  const at = Math.min(3, Math.max(1, name.length - 2));

  return name.slice(0, at) + name[at] + name.slice(at);
}

// A paper a check found edited: a forgery, a synthetic ID, a selfie taken off a screen.
const ALTERED = /altered|synthetic|template|forg|screen/i;

/**
 * What a scan shows. A failed paper shows why it failed. A paper not checked yet (or that the check
 * could not read) is clean most of the time: an ID shows the flaw random.js scanFlaw fixes for it
 * (the ID check reads the same), another paper one of `choices` now and then.
 */
// Why a paper failed, as the scan shows it (first match wins).
const FAILED_LOOKS: [RegExp, string][] = [
  [ALTERED, 'altered'],
  [/blurry/i, 'blurry'],
  [/selfie/i, 'other_face'],
  [/name/i, 'name'],
];

function flawOf(doc, choices) {
  if (doc.check_result === 'FAILED') {
    const look = FAILED_LOOKS.find(([pattern]) => pattern.test(doc.failure_reason || ''));
    if (look) return look[1];
  }

  if (doc.check_result && doc.check_result !== 'MANUAL_REVIEW') return null;

  if (choices.includes('glare')) {
    const flaw = scanFlaw(doc.id);

    return flaw === 'clean' ? null : flaw;
  }

  return seeded(doc.id, 'flaw') % 10 < 7 ? null : choose(doc.id, choices, 'which');
}

/** An edited area: a patch of another paper's colour, pasted over what was there. */
function pasted(page, x, y, width, height) {
  page.rect(x, y, width, height, '#fdf6d8', '#e5c97a');
}

/** A forged ID: the name and the photo pasted from elsewhere, another font, the edges show. */
function pastedIdentity(page, person) {
  pasted(page, 132, 50, 140, 52);
  page.text(137, 69, person.last_name || '', { size: 12, color: '#1f2937' });
  page.text(139, 98, person.first_name || '', { size: 10, color: '#1f2937' });
  page.rect(13, 45, 110, 138, null, '#e5c97a');
}

/** The two machine-readable lines at the bottom of an ID (simplified, no check digits). */
function machineReadable(doc, person, code, country) {
  const line1 = `${code === 'P' ? 'P' : 'I'}<${ISO3[country] || `${country}X`}${mrzName(
    person.last_name,
  )}<<${mrzName(person.first_name)}`;
  const line2 = `${mrzName(doc.document_number)}<${ISO3[person.nationality] || 'XXX'}${yymmdd(
    person.date_of_birth,
  )}<${yymmdd(doc.expires_at)}`;

  return [line1, line2];
}

function identityDocument(doc) {
  const person = doc.individual || {};
  const [title, background, ink, code] = ID_STYLE[doc.document_type];
  const flaw = flawOf(doc, ['glare', 'cropped', 'name']);
  const page = new Page(430, 280);
  const country = doc.issuing_country || person.nationality || '';
  page.rect(0, 0, 430, 280, background);
  page.rect(0, 0, 430, 34, ink);
  page.text(16, 22, title, { size: 13, font: 'F2', color: '#ffffff' });
  page.text(390, 22, country, { size: 11, font: 'F2', color: '#ffffff' });
  portrait(page, 16, 48, 104, 132, seeded(doc.individual_id || doc.id, 'face'));
  const surname = flaw === 'name' ? misspelt(person.last_name || '') : person.last_name;
  const fields = [
    ['Surname', surname],
    ['Given names', person.first_name],
    ['Date of birth', day(person.date_of_birth)],
    ['Nationality', person.nationality],
    ['Document no.', doc.document_number],
    ['Issued', day(doc.issued_at)],
    ['Expires', day(doc.expires_at)],
  ];
  fields.forEach(([label, value], i) => {
    const [x, y] = i < 4 ? [136, 56 + i * 31] : [282, 56 + (i - 4) * 31];
    page.text(x, y, label, { size: 7, color: '#6b7280' });

    if (flaw === 'blurry' && label === 'Document no.') {
      [-1.2, 0, 1.4].forEach(d =>
        page.text(x + d, y + 13 + d / 2, value, { size: 11, color: '#9ca3af' }),
      );
    } else {
      page.text(x, y + 13, value, { size: 11, font: 'F2', color: '#111827' });
    }
  });
  const [line1, line2] = machineReadable(doc, person, code, country);
  page.rect(0, 212, 430, 68, '#ffffff');
  [line1, line2].forEach((line, i) =>
    page.text(14, 238 + i * 20, line.padEnd(36, '<').slice(0, 36), { size: 13, font: 'F3' }),
  );
  if (flaw === 'altered') pastedIdentity(page, person);
  specimen(page);
  if (flaw === 'glare') page.ellipse(322, 66, 62, 26, '#ffffff', true);
  if (flaw === 'cropped') page.rect(0, 196, 430, 84, '#f3f4f6');

  return page;
}

function selfie(doc) {
  const person = doc.individual || {};
  const page = new Page(300, 380);
  const flaw = flawOf(doc, ['dark', 'covered']);
  const look = seeded(doc.individual_id || doc.id, 'face') + (flaw === 'other_face' ? 1 : 0);
  page.rect(0, 0, 300, 380, '#111827');
  portrait(page, 30, 40, 240, 260, look);
  if (flaw === 'dark') page.ellipse(150, 170, 160, 170, '#111827', true);
  if (flaw === 'covered') page.rect(92, 128, 116, 30, '#111827');

  // A photo of a screen: the lines of the display run across the face.
  if (flaw === 'altered') {
    Array.from({ length: 13 }, (unused, i) => page.rect(30, 44 + i * 20, 240, 3, '#4b5563'));
  }

  page.rect(0, 300, 300, 80, '#111827');
  page.text(20, 326, 'Liveness check', { size: 12, font: 'F2', color: '#ffffff' });
  page.text(20, 344, fullName(person), { size: 10, color: '#d1d5db' });
  page.text(20, 362, `Captured ${day(doc.uploaded_at)} in the app`, { size: 9, color: '#9ca3af' });
  specimen(page);

  return page;
}

// ---- letters: bills, notices, payslips, statements --------------------------------------------------

const ISSUERS = {
  'facture_edf.pdf': ['EDF', 'Electricity bill', '#1d4ed8'],
  'facture_orange.pdf': ['Orange', 'Internet and phone bill', '#ea580c'],
  'quittance_loyer.pdf': ['Foncia Gestion', 'Rent receipt', '#047857'],
  'avis_imposition.pdf': [
    'Direction générale des Finances publiques',
    'Income tax notice',
    '#1e3a8a',
  ],
  'justificatif_domicile.pdf': ['Engie', 'Gas bill', '#0e7490'],
  'attestation_assurance_habitation.pdf': ['MAIF', 'Home insurance certificate', '#7c3aed'],
  'bulletin_salaire.pdf': [null, 'Payslip', '#374151'],
  'releve_bancaire.pdf': ['Société Générale', 'Bank statement', '#b91c1c'],
};
const INCOME = {
  BELOW_20K: 17000,
  FROM_20K_TO_40K: 31000,
  FROM_40K_TO_70K: 52000,
  FROM_70K_TO_120K: 88000,
  ABOVE_120K: 150000,
};

function letter(issuer, title, color, doc) {
  const page = new Page(595, 842);
  page.rect(0, 0, 595, 90, color);
  page.text(48, 52, issuer, { size: 20, font: 'F2', color: '#ffffff' });
  page.text(48, 140, title, { size: 18, font: 'F2' });
  page.text(48, 162, `Issued on ${day(doc.issued_at || doc.uploaded_at)}`, {
    size: 10,
    color: '#4b5563',
  });

  return page;
}

function addressBlock(page, name, lines) {
  page.rect(330, 120, 220, 74, '#f9fafb', '#e5e7eb');
  [name, ...lines].forEach((line, i) =>
    page.text(342, 140 + i * 16, line, { size: 10, font: i ? 'F1' : 'F2' }),
  );
}

function table(page, top, rows) {
  rows.forEach(([label, value], i) => {
    const y = top + i * 26;
    if (i % 2 === 0) page.rect(48, y - 16, 500, 26, '#f3f4f6');
    page.text(58, y, label, { size: 10 });
    page.text(250, y, value, { size: 10, font: 'F2' });
  });
}

function personalLetter(doc) {
  const person = doc.individual || {};
  const [issuer, title, color] = ISSUERS[doc.file_name] || ISSUERS['justificatif_domicile.pdf'];
  const flaw = flawOf(doc, ['other_name', 'cropped']);
  const n = seeded(doc.id, 'amount');
  let name = fullName(person);

  if (flaw === 'other_name') {
    name = `${choose(doc.id, ['Jean', 'Monique', 'Bernard', 'Sylvie'], 'who')} ${person.last_name}`;
  }

  const income = INCOME[person.income_band] || 31000;
  const page = letter(issuer || person.employer || 'Employer', title, color, doc);
  addressBlock(page, name, addressLines(person));
  const rows = {
    'Electricity bill': [
      ['Consumption, 2 months', money(40 + (n % 90))],
      ['Subscription', money(28.4)],
      ['Taxes', money(12 + (n % 15))],
    ],
    'Gas bill': [
      ['Consumption, 2 months', money(35 + (n % 80))],
      ['Subscription', money(22.1)],
    ],
    'Internet and phone bill': [
      ['Fibre and TV plan', money(39.99)],
      ['Mobile plan', money(14.99)],
    ],
    'Rent receipt': [
      ['Rent', money(650 + (n % 900))],
      ['Service charges', money(60 + (n % 80))],
    ],
    'Home insurance certificate': [
      ['Insured home', addressLines(person)[0]],
      ['Valid until', `31/12/${new Date().getFullYear()}`],
    ],
    'Income tax notice': [
      ['Reference taxable income', money(Math.round(income * 0.9))],
      ['Number of tax shares', String(1 + (n % 3))],
      ['Tax due', money(Math.round(income * 0.09))],
    ],
    Payslip: [
      ['Employee', fullName(person)],
      ['Position', person.occupation || ''],
      ['Gross monthly salary', money(Math.round(income / 12))],
      ['Social contributions', `- ${money(Math.round((income / 12) * 0.22))}`],
      ['Net pay', money(Math.round((income / 12) * 0.78))],
    ],
    'Bank statement': [
      ['Opening balance', money(800 + (n % 4000))],
      ['Salary', `+ ${money(Math.round((income / 12) * 0.78))}`],
      ['Rent', `- ${money(650 + (n % 900))}`],
      ['Card payments', `- ${money(300 + (n % 700))}`],
    ],
  }[title];
  table(page, 260, rows || []);
  page.text(
    48,
    780,
    `${issuer || person.employer || ''} · document generated for the Forest demo`,
    {
      size: 8,
      color: '#9ca3af',
    },
  );

  if (flaw === 'altered' && rows?.length) {
    // An amount typed over the original: the patch and another font show.
    pasted(page, 240, 244, 210, 26);
    page.text(254, 261, rows[0][1], { size: 11, color: '#374151' });
  }

  specimen(page);
  if (flaw === 'cropped') page.rect(0, 330, 595, 512, '#f3f4f6');

  return page;
}

// ---- company documents -------------------------------------------------------------------------------

function companyDocument(doc, owners) {
  const company = doc.business || {};
  const flaw = flawOf(
    doc,
    doc.document_type === 'COMPANY_REGISTRATION' ? ['cropped'] : ['unsigned'],
  );
  const n = seeded(doc.business_id || doc.id, 'capital');
  const capital = money([1000, 5000, 10000, 37000, 100000][n % 5]);
  const titles = {
    COMPANY_REGISTRATION: ['Extract from the trade and companies register (Kbis)', '#1e3a8a'],
    ARTICLES_OF_ASSOCIATION: ['Articles of association', '#374151'],
    UBO_DECLARATION: ['Declaration of beneficial owners', '#0f766e'],
  };
  const [title, color] = titles[doc.document_type];
  const page = new Page(595, 842);
  page.rect(0, 0, 595, 90, color);
  page.text(48, 52, `Registry of the commercial court of ${company.city || 'Paris'}`, {
    size: 14,
    font: 'F2',
    color: '#ffffff',
  });
  page.text(48, 140, title, { size: 16, font: 'F2' });
  page.text(48, 162, `Up to date on ${day(doc.issued_at)}`, { size: 10, color: '#4b5563' });
  const rows = [
    ['Company name', company.legal_name],
    ['Registration', `${company.registration_number} R.C.S. ${company.city || ''}`],
    ['Legal form', `${company.legal_form || ''}, share capital ${capital}`],
    ['Registered office', addressLines(company).join(', ')],
    ['Registered on', day(company.incorporation_date)],
  ];
  if (doc.document_type === 'COMPANY_REGISTRATION') rows.push(['Activity', company.industry || '']);
  table(page, 210, rows);
  let y = 210 + rows.length * 26 + 30;

  if (doc.document_type === 'UBO_DECLARATION') {
    page.text(48, y, 'Persons holding more than 25% of the shares or voting rights', {
      size: 11,
      font: 'F2',
    });
    const declared = owners.length ? owners : [['Declared by the legal representative', '']];
    table(page, y + 30, declared);
    y += 30 + declared.length * 26 + 20;
  }

  if (doc.document_type !== 'COMPANY_REGISTRATION') {
    page.text(48, y + 30, 'Signature of the legal representative', { size: 10, color: '#4b5563' });
    page.rect(48, y + 40, 220, 70, null, '#d1d5db');

    if (flaw !== 'unsigned') {
      const s = seeded(doc.id, 'sign');
      page.scribble(
        // eslint-disable-next-line no-bitwise -- a few bits of the seed
        [0, 1, 2, 3, 4, 5, 6].map(i => [70 + i * 25, y + 80 + ((s >> i) % 3) * 9 - (i % 2) * 14]),
        '#1e3a8a',
      );
    }
  }

  specimen(page);
  if (flaw === 'cropped') page.rect(0, 300, 595, 542, '#f3f4f6');

  return page;
}

// ---- chargeback file -----------------------------------------------------------------------------------

/** What the bank sends the card network: the claim, the customer's words, the merchant's answer. */
function chargebackFile(cb) {
  const tx = cb.transaction || {};
  const customer = cb.customer || {};
  const page = new Page(595, 842);
  const color = cb.network === 'VISA' ? '#1a1f71' : '#eb001b';
  page.rect(0, 0, 595, 90, color);
  page.text(48, 52, `${cb.network === 'VISA' ? 'Visa Resolve Online' : 'Mastercom'} · Chargeback`, {
    size: 18,
    font: 'F2',
    color: '#ffffff',
  });
  page.text(48, 140, `Case ${cb.reference || ''}`, { size: 16, font: 'F2' });
  page.text(48, 162, `Filed on ${day(cb.filed_at)} by Forest Lab Bank (issuer)`, {
    size: 10,
    color: '#4b5563',
  });
  table(page, 210, [
    ['Network case', cb.processor_dispute_id],
    ['Reason code', `${cb.reason_code} · ${cb.reason_description}`],
    ['Disputed amount', money(cb.amount)],
    ['Transaction', `${tx.description || ''} on ${day(tx.created_at)}`],
    ['Cardholder', `${customer.display_name || ''} (${customer.reference || ''})`],
  ]);
  page.text(48, 370, 'Cardholder statement', { size: 11, font: 'F2' });
  page.text(
    48,
    392,
    cb.dispute_request?.reason_detail || 'Detected by the bank’s fraud monitoring.',
    {
      size: 10,
    },
  );

  if (cb.representment_reason) {
    page.text(48, 440, 'Merchant’s answer (representment)', { size: 11, font: 'F2' });
    page.text(
      48,
      462,
      `${cb.representment_reason}. Received ${day(cb.representment_received_at)}.`,
      {
        size: 10,
      },
    );
  }

  page.text(48, 780, 'Forest Lab Bank · document generated for the Forest demo', {
    size: 8,
    color: '#9ca3af',
  });
  specimen(page);

  return page;
}

const chargebackUri = cb =>
  `data:application/pdf;base64,${pdf(chargebackFile(cb)).toString('base64')}`;

const CHARGEBACK_DEPENDENCIES = [
  'reference',
  'network',
  'reason_code',
  'reason_description',
  'amount',
  'filed_at',
  'processor_dispute_id',
  'representment_reason',
  'representment_received_at',
  'transaction:description',
  'transaction:created_at',
  'customer:display_name',
  'customer:reference',
  'dispute_request:reason_detail',
];

// ---- invoice ------------------------------------------------------------------------------------------

// French format with a plain space between thousands (the PDF fonts have no narrow space).
const euro = n =>
  `${Number(n || 0)
    .toLocaleString('fr-FR', { minimumFractionDigits: 2 })
    .replace(/[\u202f\u00a0]/g, ' ')} €`;
const NATURE = {
  GOODS: 'Livraison de biens',
  SERVICES: 'Prestation de services',
  MIXED: 'Biens et services',
};

function party(page, x, title, lines) {
  page.text(x, 150, title, { size: 9, color: '#6b7280' });
  lines
    .filter(Boolean)
    .forEach((line, i) => page.text(x, 168 + i * 15, line, { size: 10, font: i ? 'F1' : 'F2' }));
}

/** What every French B2B invoice must say about late payment, and the VAT option. */
function legalMentions(page, inv) {
  [
    inv.vat_on_debits ? 'Option pour le paiement de la TVA d’après les débits.' : null,
    Number(inv.vat_rate) === 0 ? 'Exonération de TVA, article 261-4-1° du CGI.' : null,
    'Pénalités de retard : trois fois le taux d’intérêt légal.',
    'Indemnité forfaitaire pour frais de recouvrement : 40 €. Pas d’escompte pour paiement anticipé.',
  ]
    .filter(Boolean)
    .forEach((line, i) => page.text(48, 620 + i * 14, line, { size: 8, color: '#4b5563' }));
}

/** The seller and the buyer: our customer's company on one side, the other party on the other. */
function parties(inv) {
  const business = inv.business || {};
  const capital = choose(
    business.registration_number || '',
    ['1 000', '5 000', '10 000', '37 000'],
    'k',
  );
  const ours = [
    business.legal_name,
    business.address_line1,
    `${business.postal_code || ''} ${business.city || ''}`.trim(),
    `${business.legal_form || ''} au capital de ${capital} €`,
    `SIREN ${business.registration_number || ''} · RCS ${business.city || ''}`,
    `TVA ${business.vat_number || ''}`,
  ];
  const city = String(inv.other_party_address || '').replace(/.*\d{5} /, '');
  const name = inv.other_party_name || '';
  const form = (name.match(/\b(SARL|SAS|SASU|EURL|SA|SELARL)$/) || [])[1] || 'SAS';
  const theirCapital = choose(name, ['1 000', '8 000', '20 000', '100 000'], 'k');
  const theirs = [
    name,
    inv.other_party_address,
    `${form} au capital de ${theirCapital} €`,
    inv.other_party_siren
      ? `SIREN ${inv.other_party_siren} · RCS ${city}`
      : 'SIREN : non renseigné',
    inv.other_party_vat_number ? `TVA ${inv.other_party_vat_number}` : null,
  ];

  return inv.direction === 'ISSUED' ? [ours, theirs] : [theirs, ours];
}

/** The invoice as the buyer sees it: a Factur-X style PDF with the French mandatory mentions. */
function invoiceFile(inv) {
  const [seller, buyer] = parties(inv);
  const page = new Page(595, 842);
  page.rect(0, 0, 595, 80, '#0f172a');
  page.text(48, 48, `FACTURE N° ${inv.invoice_number || ''}`, {
    size: 18,
    font: 'F2',
    color: '#ffffff',
  });
  page.text(400, 48, inv.format === 'FACTUR_X' ? 'Factur-X' : inv.format || '', {
    size: 11,
    color: '#ddf327',
  });
  party(page, 48, 'VENDEUR', seller);
  party(page, 320, 'ACHETEUR', buyer);
  table(page, 280, [
    ['Date d’émission', day(inv.issue_date)],
    ['Date de livraison ou d’exécution', day(inv.delivery_date)],
    ['Date d’échéance', day(inv.due_date)],
    ['Nature de l’opération', NATURE[inv.nature] || 'non renseignée'],
  ]);
  const columns = [58, 262, 300, 372, 436, 492];
  page.rect(48, 392, 500, 24, '#e5e7eb');
  ['Désignation', 'Qté', 'PU HT', 'Total HT', `TVA ${inv.vat_rate ?? ''} %`, 'TTC'].forEach(
    (h, i) => page.text(columns[i], 408, h, { size: 9, font: 'F2' }),
  );
  [
    inv.description || '',
    String(inv.quantity ?? 1),
    euro(inv.unit_price),
    euro(inv.amount_excl_vat),
    euro(inv.vat_amount),
    euro(inv.amount_incl_vat),
  ].forEach((v, i) => page.text(columns[i], 438, v, { size: 9 }));
  page.rect(330, 470, 218, 70, '#f9fafb', '#e5e7eb');
  page.text(342, 492, `Total HT  ${euro(inv.amount_excl_vat)}`, { size: 10 });
  page.text(342, 510, `TVA  ${euro(inv.vat_amount)}`, { size: 10 });
  page.text(342, 530, `Net à payer  ${euro(inv.amount_incl_vat)}`, { size: 11, font: 'F2' });
  page.text(48, 560, 'Paiement par virement', { size: 10, font: 'F2' });
  page.text(48, 578, `IBAN ${inv.payee_iban || ''}`, { size: 10, font: 'F3' });
  legalMentions(page, inv);
  page.text(
    48,
    780,
    'Facture électronique transmise par Forest Lab Bank, plateforme agréée · démo Forest',
    {
      size: 8,
      color: '#9ca3af',
    },
  );
  specimen(page);

  return page;
}

const invoiceUri = inv => `data:application/pdf;base64,${pdf(invoiceFile(inv)).toString('base64')}`;

const INVOICE_DEPENDENCIES = [
  'invoice_number',
  'direction',
  'quantity',
  'unit_price',
  'delivery_date',
  'format',
  'issue_date',
  'due_date',
  'nature',
  'vat_on_debits',
  'description',
  'vat_rate',
  'amount_excl_vat',
  'vat_amount',
  'amount_incl_vat',
  'payee_iban',
  'other_party_name',
  'other_party_address',
  'other_party_siren',
  'other_party_vat_number',
  ...[
    'legal_name',
    'legal_form',
    'address_line1',
    'postal_code',
    'city',
    'registration_number',
    'vat_number',
  ].map(f => `business:${f}`),
];

// ---- entry point ---------------------------------------------------------------------------------------

function draw(doc, owners = []) {
  if (ID_STYLE[doc.document_type]) return identityDocument(doc);
  if (doc.document_type === 'SELFIE') return selfie(doc);
  if (doc.business_id) return companyDocument(doc, owners);

  return personalLetter(doc);
}

const pdfUri = (doc, owners) =>
  `data:application/pdf;base64,${pdf(draw(doc, owners)).toString('base64')}`;

/** The same document as an SVG picture (the desk's preview on hover). */
const documentSvg = (doc, owners) => svg(draw(doc, owners));

/** A document shows the address the person had when they sent it, not the one they moved to. */
function addressAtUpload(doc, moves = []) {
  const move = moves.find(m => String(m.decided_at) > String(doc.uploaded_at));
  if (!move || !doc.individual) return doc;
  const cut = move.old_value.lastIndexOf(', ');
  const [postalCode, ...city] = move.old_value.slice(cut + 2).split(' ');
  const address = {
    address_line1: move.old_value.slice(0, cut),
    postal_code: postalCode,
    city: city.join(' '),
  };

  return { ...doc, individual: { ...doc.individual, ...address } };
}

const DEPENDENCIES = [
  'id',
  'document_type',
  'document_number',
  'issued_at',
  'expires_at',
  'issuing_country',
  'uploaded_at',
  'file_name',
  'check_result',
  'failure_reason',
  'individual_id',
  'business_id',
  ...[
    'first_name',
    'last_name',
    'date_of_birth',
    'nationality',
    'address_line1',
    'postal_code',
    'city',
    'income_band',
    'occupation',
    'employer',
  ].map(f => `individual:${f}`),
  ...[
    'legal_name',
    'registration_number',
    'legal_form',
    'address_line1',
    'postal_code',
    'city',
    'incorporation_date',
    'industry',
  ].map(f => `business:${f}`),
];

// ---- SAR draft (déclaration de soupçon) ----------------------------------------------------------------

/** Cuts a text into lines of at most `width` characters, on spaces. */
function wrapText(text, width) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean)
    .reduce(
      (lines, word) => {
        const last = lines[lines.length - 1];

        if (!last || `${last} ${word}`.length <= width) {
          lines[lines.length - 1] = `${last} ${word}`.trim();
        } else {
          lines.push(word);
        }

        return lines;
      },
      [''],
    );
}

const SAR_ROWS_SHOWN = 14;

function sarTransactions(page, top, transactions) {
  const shown = transactions.slice(0, SAR_ROWS_SHOWN);
  page.rect(48, top, 500, 22, '#e5e7eb');
  page.text(58, top + 15, 'Date', { size: 9, font: 'F2' });
  page.text(140, top + 15, 'Libellé', { size: 9, font: 'F2' });
  page.text(470, top + 15, 'Montant', { size: 9, font: 'F2' });
  shown.forEach((tx, i) => {
    const y = top + 38 + i * 18;
    if (i % 2) page.rect(48, y - 13, 500, 18, '#f9fafb');
    page.text(58, y, day(tx.created_at), { size: 9 });
    page.text(140, y, String(tx.description || '').slice(0, 58), { size: 9 });
    page.text(462, y, euro(tx.amount).padStart(14), { size: 9, font: 'F3' });
  });
  const more = transactions.length - shown.length;
  const end = top + 38 + shown.length * 18;

  if (more > 0) {
    page.text(58, end, `… et ${more} autre(s) opération(s), listées dans le dossier.`, {
      size: 9,
      color: '#6b7280',
    });
  }

  return end + (more > 0 ? 18 : 0);
}

/**
 * The SAR draft the MLRO reviews before filing it with TRACFIN: who declares, on whom, what, and
 * the transactions. `sar` holds the row; `customer`, `investigation`, `transactions` its context.
 */
function sarFile({
  sar,
  customer = {},
  investigation = {},
  transactions = [],
  activity,
}: {
  sar;
  customer?;
  investigation?;
  transactions?;
  activity;
}) {
  const page = new Page(595, 842);
  page.rect(0, 0, 595, 86, '#0f172a');
  page.rect(0, 86, 595, 4, '#ddf327');
  page.text(48, 40, 'DÉCLARATION DE SOUPÇON', { size: 18, font: 'F2', color: '#ffffff' });
  page.text(48, 64, 'Article L.561-15 du Code monétaire et financier · destinataire : TRACFIN', {
    size: 9,
    color: '#cbd5e1',
  });
  page.text(420, 40, sar.reference || '', { size: 11, font: 'F2', color: '#ddf327' });
  page.rect(392, 112, 156, 34, null, '#dc2626');
  page.text(404, 134, 'DRAFT — not sent', { size: 13, font: 'F2', color: '#dc2626' });
  page.text(48, 126, 'Déclarant', { size: 9, color: '#6b7280' });
  page.text(48, 142, 'Forest Lab Bank · service conformité (MLRO)', { size: 11, font: 'F2' });
  table(page, 186, [
    ['Personne concernée', `${customer.display_name || ''} (${customer.reference || ''})`],
    [
      'Type de client',
      customer.customer_type === 'BUSINESS' ? 'Personne morale' : 'Personne physique',
    ],
    ['Nature du soupçon', activity],
    ['Période', `du ${day(sar.activity_start_date)} au ${day(sar.activity_end_date)}`],
    ['Montant total', `${euro(sar.total_amount)} · ${sar.transaction_count} opération(s)`],
    ['Dossier interne', `${investigation.reference || ''} · rédigé le ${day(sar.created_at)}`],
  ]);
  page.text(48, 360, 'Opérations signalées', { size: 11, font: 'F2' });
  const end = sarTransactions(page, 372, transactions);
  page.text(48, end + 24, 'Exposé des faits', { size: 11, font: 'F2' });
  wrapText(sar.narrative, 96)
    .slice(0, 10)
    .forEach((line, i) => page.text(48, end + 44 + i * 14, line, { size: 10 }));
  page.text(
    48,
    760,
    'Confidentiel : ne pas informer le client (art. L.561-18 CMF, interdiction de divulgation).',
    {
      size: 8,
      color: '#b91c1c',
    },
  );
  page.text(
    48,
    780,
    'Forest Lab Bank · brouillon généré pour la démo Forest, non transmis à TRACFIN',
    {
      size: 8,
      color: '#9ca3af',
    },
  );
  specimen(page);

  return page;
}

// ---- result cards (HTML shown by the Smart Action result) ------------------------------------------------

const escapeHtml = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );

// Amounts and dates on result cards and record labels: the fr-FR form the evidence fields use.
const euros = n =>
  `${Number(n).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
const PARIS = { timeZone: 'Europe/Paris' };
const frDate = value => (value ? new Date(value).toLocaleDateString('fr-FR', PARIS) : null);
const frStamp = value =>
  value
    ? `${frDate(value)} ${new Date(value).toLocaleTimeString('fr-FR', {
        ...PARIS,
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : null;

// Codes read as words on a card: "SEPA_DISPUTE" → "SEPA dispute", "ACCOUNT_TAKEOVER" → "Account
// takeover". Acronyms stay in capitals; a few codes have a name of their own.
const ACRONYMS = new Set(['AML', 'PEP', 'KYC', 'SEPA', 'SCT', 'SDD', 'B2B', 'ATM', 'IBAN', 'MFA']);
const NAMED = {
  SEPA: 'SEPA Credit Transfer',
  SEPA_INSTANT: 'SEPA Instant',
  SCT_INST: 'SCT Inst',
  CHARGEBACK: 'Card chargeback',
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  UNAUTHORIZED: 'Unauthorised',
};
const codeText = code =>
  code
    ? NAMED[code] ||
      String(code)
        .split('_')
        .map((w, i) => {
          if (ACRONYMS.has(w)) return w;

          return i ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase();
        })
        .join(' ')
    : '';

const TONES = {
  green: ['#dcfce7', '#166534'],
  amber: ['#fef3c7', '#92400e'],
  red: ['#fee2e2', '#991b1b'],
  grey: ['#f3f4f6', '#374151'],
};

/** A coloured pill, as raw HTML (pass it in a cell as { html }). */
function badge(text, tone = 'grey') {
  const [bg, fg] = TONES[tone] || TONES.grey;

  return (
    `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};` +
    `color:${fg};font-size:12px;font-weight:600;white-space:nowrap">${escapeHtml(text)}</span>`
  );
}

const cellHtml = value => (value && value.html !== undefined ? value.html : escapeHtml(value));
const TD = 'padding:6px 8px;border-top:1px solid #f0f0f0;vertical-align:top';

function cardTable(head, rows) {
  const th = head
    .map(
      h =>
        `<th style="text-align:left;padding:6px 8px;color:#6b7280;font-weight:500">${escapeHtml(
          h,
        )}</th>`,
    )
    .join('');
  const body = rows
    .map(row => `<tr>${row.map(c => `<td style="${TD}">${cellHtml(c)}</td>`).join('')}</tr>`)
    .join('');

  return `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px"><tr>${th}</tr>${body}</table>`;
}

/**
 * A white card with the accent stripe: an eyebrow (who answered), a title and a badge, label/value
 * rows, an optional table ({ head, rows }) and a grey note. Cell values are text, or { html }.
 */
function card({
  eyebrow,
  title,
  status,
  rows = [],
  list,
  note,
}: {
  eyebrow?;
  title;
  status?;
  rows?;
  list?;
  note?;
}) {
  const facts = rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap">${escapeHtml(
          label,
        )}</td>` +
        `<td style="padding:4px 0;color:#111827;font-weight:500">${cellHtml(value)}</td></tr>`,
    )
    .join('');

  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Inter,Segoe UI,sans-serif;background:#fff;',
    'border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;max-width:620px;color:#111827">',
    '<div style="height:4px;background:#ddf327"></div><div style="padding:14px 16px">',
    eyebrow
      ? `<div style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#6b7280">${escapeHtml(
          eyebrow,
        )}</div>`
      : '',
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 10px">',
    `<div style="font-size:16px;font-weight:600">${escapeHtml(title)}</div>${
      status ? badge(status[0], status[1]) : ''
    }</div>`,
    facts ? `<table style="border-collapse:collapse;font-size:13px">${facts}</table>` : '',
    list ? cardTable(list.head, list.rows) : '',
    note
      ? `<div style="margin-top:12px;font-size:12px;color:#6b7280">${escapeHtml(note)}</div>`
      : '',
    '</div></div>',
  ].join('');
}

export {
  CHARGEBACK_DEPENDENCIES,
  DEPENDENCIES,
  INVOICE_DEPENDENCIES,
  addressAtUpload,
  badge,
  card,
  chargebackUri,
  codeText,
  documentSvg,
  draw,
  euros,
  frDate,
  frStamp,
  invoiceUri,
  pdf,
  pdfUri,
  sarFile,
  svg,
};
