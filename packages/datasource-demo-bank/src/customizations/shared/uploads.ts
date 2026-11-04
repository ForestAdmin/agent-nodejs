/**
 * Files a customer sends through a partner's app (see the CLI's PARTNER_PORTAL.md),
 * copied by the bank. The Gateway API takes 16 KB per request, too little for a photo or a PDF, so the
 * "Upload document" action gets a link on the portal and fetches the file itself: only from the
 * portal's own address (DEMO_BANK_PORTAL_ORIGINS), only a PDF, PNG or JPEG, at most 5 MB.
 *
 * Seeded documents are drawn from their record (render.js); an uploaded one keeps its own file,
 * here, in memory. The SQLite file is seeded again on every boot, so the files and the rows they
 * belong to go away together.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 300;
// What the kept files may hold in all, as data URIs: base64 makes a 5 MB file about 6.7 MB.
const MAX_STORED_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const DEFAULT_ORIGINS = 'http://localhost:3500,http://127.0.0.1:3500';
// What the file is, from its first bytes: never from what the sender says it is.
const SIGNATURES: [string, string, number[]][] = [
  ['application/pdf', 'pdf', [0x25, 0x50, 0x44, 0x46]],
  ['image/png', 'png', [0x89, 0x50, 0x4e, 0x47]],
  ['image/jpeg', 'jpg', [0xff, 0xd8, 0xff]],
];
// The portal's sample files say which flaw their scan shows (render.js draws it), so the checks
// answer what the picture shows: an ID's flaw (random.js scanFlaw reads the same from the
// document's id), a selfie of another face, a bill addressed to someone else. And the date printed
// on the paper, which the bank reads as a real one would (a proof of address must be recent).
const SCAN_MARK = /%forest-lab-scan:(clean|glare|cropped|name|other_face|other_name)/;
const ISSUED_MARK = /%forest-lab-issued:(\d{4}-\d{2}-\d{2})/;

const TOO_LARGE = 'The file is larger than 5 MB.';

const files = new Map();
let storedBytes = 0;

class UploadError extends Error {}

/** The portal origins, each as the browser writes it: https://p.example:443/x is https://p.example. */
const allowedOrigins = () =>
  (process.env.DEMO_BANK_PORTAL_ORIGINS || DEFAULT_ORIGINS)
    .split(',')
    .map(entry => {
      try {
        return new URL(entry.trim()).origin;
      } catch {
        return null;
      }
    })
    // "localhost:3500" parses as a scheme, with no origin: not an address the bank can match.
    .filter(origin => origin && origin !== 'null');

function sniff(buffer) {
  const found = SIGNATURES.find(([, , bytes]) => bytes.every((b, i) => buffer[i] === b));
  if (!found) throw new UploadError('The file is not a PDF, PNG or JPEG.');

  return { mime: found[0], extension: found[1] };
}

// .jpeg and .jpg name the same type.
const extensionKey = extension => extension.toLowerCase().replace('jpeg', 'jpg');

/**
 * A file name safe to show and store: letters, digits, dots, dashes, at most 80 characters, and
 * the extension of what the file is ("evil.html" on a PNG is filed as "evil.png").
 */
function safeName(name, extension) {
  const base = String(name || '')
    .split(/[\\/]/)
    .pop()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 80);
  if (!base) return `document.${extension}`;
  const given = /\.([a-z0-9]{2,4})$/i.exec(base);
  if (!given) return `${base}.${extension}`;

  return extensionKey(given[1]) === extensionKey(extension)
    ? base
    : `${base.slice(0, given.index)}.${extension}`;
}

function checked(buffer, name) {
  if (!buffer.length) throw new UploadError('The file is empty.');
  if (buffer.length > MAX_BYTES) throw new UploadError(TOO_LARGE);
  const { mime, extension } = sniff(buffer);
  const tail = buffer.subarray(Math.max(0, buffer.length - 256)).toString('latin1');

  return {
    buffer,
    mime,
    name: safeName(name, extension),
    scan: SCAN_MARK.exec(tail)?.[1] || null,
    issued: ISSUED_MARK.exec(tail)?.[1] || null,
  };
}

function nameFrom(response, url) {
  const disposition = response.headers.get('content-disposition') || '';
  const quoted = /filename="([^"]+)"/i.exec(disposition)?.[1];

  if (quoted) return quoted;
  const last = url.pathname.split('/').pop() || '';

  try {
    return decodeURIComponent(last);
  } catch {
    // A broken escape (%E0%A4%A): the name as sent, which safeName cleans.
    return last;
  }
}

/** The body, read as it comes: past 5 MB the bank stops reading, whatever the headers said. */
async function bodyOf(response, origin) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;

  try {
    let chunk = await reader.read();

    while (!chunk.done) {
      size += chunk.value.length;

      if (size > MAX_BYTES) {
        // eslint-disable-next-line no-await-in-loop
        await reader.cancel();
        throw new UploadError(TOO_LARGE);
      }

      chunks.push(chunk.value);
      // eslint-disable-next-line no-await-in-loop
      chunk = await reader.read();
    }
  } catch (error) {
    if (error instanceof UploadError) throw error;
    // The portal hung up or timed out halfway.
    throw new UploadError(`The partner portal did not hand over the file (${origin}).`);
  }

  return Buffer.concat(chunks);
}

/** Fetches a file the portal holds. Refuses any other address, and redirects. */
async function fetchUpload(link) {
  let url;

  try {
    url = new URL(String(link || '').trim());
  } catch {
    throw new UploadError('The file URL is not a valid link.');
  }

  if (!allowedOrigins().includes(url.origin)) {
    throw new UploadError(`Files are only taken from the partner portal, not from ${url.origin}.`);
  }

  let response;

  try {
    response = await fetch(url, {
      redirect: 'error',
      // A compressed body would be unpacked past any size the headers announce.
      headers: { 'accept-encoding': 'identity' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new UploadError(`The partner portal did not hand over the file (${url.origin}).`);
  }

  if (!response.ok) throw new UploadError(`The partner portal answered ${response.status}.`);

  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new UploadError(TOO_LARGE);

  return checked(await bodyOf(response, url.origin), nameFrom(response, url));
}

/** A Smart Action File value ({ buffer, mimeType, name }), checked like a fetched file. */
const fromFileField = file => checked(Buffer.from(file.buffer || []), file.name);

function drop(id) {
  storedBytes -= files.get(id)?.uri.length || 0;
  files.delete(id);
}

/** Keeps the file of document `id`, as the data URI Forest's file viewer opens, and what its scan
 * shows (the face match reads a selfie's). The oldest files go first past `limits`. */
function keep(id, { buffer, mime, name, scan = null }, limits: { maxFiles?; maxBytes? } = {}) {
  const { maxFiles = MAX_FILES, maxBytes = MAX_STORED_BYTES } = limits;
  const uri = `data:${mime};name=${encodeURIComponent(name)};base64,${buffer.toString('base64')}`;
  drop(id);
  files.set(id, { name, mime, scan, size: buffer.length, uri });
  storedBytes += uri.length;

  // The file just kept stays, even alone over the limit.
  while (files.size > 1 && (files.size > maxFiles || storedBytes > maxBytes)) {
    drop(files.keys().next().value);
  }
}

const uploaded = id => files.get(id) || null;

export {
  MAX_BYTES,
  SCAN_MARK,
  UploadError,
  allowedOrigins,
  fetchUpload,
  fromFileField,
  keep,
  safeName,
  uploaded,
};
