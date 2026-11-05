import type { AddressInfo } from 'net';

import { createServer } from 'http';

import {
  MAX_BYTES,
  UploadError,
  allowedOrigins,
  fetchUpload,
  fromFileField,
  keep,
  safeName,
  uploaded,
} from '../src/customizations/shared/uploads';

// The first bytes of each file type the bank takes, and a text file it refuses.
const PDF_TEXT = '%PDF-1.4\n%%EOF';
const PDF = Buffer.from(PDF_TEXT);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const TEXT = Buffer.from('hello, not a document');

/** A PDF of `size` bytes: its header, then zeros. */
function pdfOf(size: number) {
  const buffer = Buffer.alloc(size);
  buffer.write(PDF_TEXT);

  return buffer;
}

/** The message of the UploadError a call refused with, or what it did instead. */
async function refusal(call: () => unknown) {
  const error = await Promise.resolve()
    .then(call)
    .then(
      () => 'accepted',
      e => e,
    );

  return error instanceof UploadError ? error.message : error;
}

describe('uploads', () => {
  describe('allowedOrigins', () => {
    it('should allow the local portal on port 3500 when no origins are given', () => {
      expect(allowedOrigins()).toEqual(['http://localhost:3500', 'http://127.0.0.1:3500']);
    });

    it('should read each origin without spaces or trailing slashes, skipping empty entries', () => {
      expect(allowedOrigins([' https://portal.example/ ', ' ', 'http://127.0.0.1:4000'])).toEqual([
        'https://portal.example',
        'http://127.0.0.1:4000',
      ]);
    });

    it('should read each entry as an origin: default port, case and path dropped, invalid skipped', () => {
      expect(
        allowedOrigins([
          'https://P.Example.com:443/upload',
          'not a link',
          'localhost:3500',
          'http://127.0.0.1:4000/',
        ]),
      ).toEqual(['https://p.example.com', 'http://127.0.0.1:4000']);
    });
  });

  describe('safeName', () => {
    it('should keep only the last path segment and replace unsafe characters', () => {
      expect(safeName('../../etc/my passport (1).pdf', 'pdf')).toBe('my_passport_1_.pdf');
      expect(safeName('C:\\Users\\me\\scan.png', 'png')).toBe('scan.png');
    });

    it('should drop leading dots and underscores so the name is never hidden', () => {
      expect(safeName('.._.hidden.jpg', 'jpg')).toBe('hidden.jpg');
    });

    it('should add the extension of the file type when the name has none', () => {
      expect(safeName('passport', 'pdf')).toBe('passport.pdf');
    });

    it('should name an unnamed file document.<extension>', () => {
      expect(safeName('', 'png')).toBe('document.png');
      expect(safeName(undefined, 'pdf')).toBe('document.pdf');
      expect(safeName('///', 'jpg')).toBe('document.jpg');
    });

    it('should cut a long name to 80 characters before adding the extension', () => {
      expect(safeName('a'.repeat(200), 'pdf')).toBe(`${'a'.repeat(80)}.pdf`);
    });

    it('should replace an extension that is not the file type, keeping one that is', () => {
      expect(safeName('evil.html', 'png')).toBe('evil.png');
      expect(safeName('scan.pdf.exe', 'pdf')).toBe('scan.pdf.pdf');
      expect(safeName('Scan.PDF', 'pdf')).toBe('Scan.PDF');
      expect(safeName('selfie.jpeg', 'jpg')).toBe('selfie.jpeg');
    });

    it('should drop accents rather than turn them into underscores', () => {
      expect(safeName('José Ñ.pdf', 'pdf')).toBe('Jose_N.pdf');
    });
  });

  describe('fromFileField', () => {
    it('should accept a PDF, keeping its bytes and its name', () => {
      const file = fromFileField({ buffer: PDF, mimeType: 'text/plain', name: 'id.pdf' });

      expect(file).toEqual({
        buffer: PDF,
        mime: 'application/pdf',
        name: 'id.pdf',
      });
    });

    it('should tell a PNG and a JPEG by their first bytes, and name them so, not as sent', () => {
      expect(fromFileField({ buffer: PNG, name: 'photo.pdf' })).toMatchObject({
        mime: 'image/png',
        name: 'photo.png',
      });
      expect(fromFileField({ buffer: JPEG, name: 'selfie' })).toMatchObject({
        mime: 'image/jpeg',
        name: 'selfie.jpg',
      });
    });

    it('should accept a file of exactly 5 MB', () => {
      const buffer = pdfOf(MAX_BYTES);

      expect(fromFileField({ buffer, name: 'big.pdf' }).buffer).toHaveLength(MAX_BYTES);
    });

    it('should refuse a file that is not a PDF, PNG or JPEG', async () => {
      expect(await refusal(() => fromFileField({ buffer: TEXT, name: 'notes.pdf' }))).toBe(
        'The file is not a PDF, PNG or JPEG.',
      );
    });

    it('should refuse an empty file, or a File value without its content', async () => {
      expect(await refusal(() => fromFileField({ buffer: Buffer.alloc(0), name: 'a.pdf' }))).toBe(
        'The file is empty.',
      );
      expect(await refusal(() => fromFileField({ name: 'a.pdf' }))).toBe('The file is empty.');
    });

    it('should refuse a file one byte over 5 MB', async () => {
      const buffer = pdfOf(MAX_BYTES + 1);

      expect(await refusal(() => fromFileField({ buffer, name: 'big.pdf' }))).toBe(
        'The file is larger than 5 MB.',
      );
    });
  });

  describe('fetchUpload', () => {
    // A partner portal on a free local port: one route per answer the bank must handle.
    let endlessEncoding: string | string[] | undefined;
    let endlessSent = 0;
    const portal = createServer((request, response) => {
      switch (request.url) {
        case '/files/endless.pdf': {
          // No Content-Length (chunked), and more bytes as long as the bank reads them.
          endlessEncoding = request.headers['accept-encoding'];
          endlessSent = 0;
          response.writeHead(200, { 'content-type': 'application/pdf' });
          const chunk = pdfOf(64 * 1024);

          const pump = () => {
            let more = true;

            while (more && !response.destroyed) {
              endlessSent += chunk.length;
              more = response.write(chunk);
            }
          };

          response.on('drain', pump);
          pump();
          break;
        }

        case '/files/hang-up.pdf':
          // The first bytes, then the connection drops halfway through the body.
          response.writeHead(200, { 'content-type': 'application/pdf' });
          response.write(PDF);
          setTimeout(() => response.socket?.destroy(), 20);
          break;
        case '/files/a%E0%A4%A.pdf':
          response.writeHead(200, { 'content-type': 'application/pdf' });
          response.end(PDF);
          break;
        case '/files/passport.pdf':
          response.writeHead(200, {
            'content-type': 'application/pdf',
            'content-disposition': 'attachment; filename="Passport scan.pdf"',
          });
          response.end(PDF);
          break;
        case '/files/bill%20june.png':
          response.writeHead(200, { 'content-type': 'image/png' });
          response.end(PNG);
          break;
        case '/files/notes.pdf':
          response.writeHead(200, { 'content-type': 'application/pdf' });
          response.end(TEXT);
          break;
        case '/files/huge.pdf':
          response.writeHead(200, {
            'content-type': 'application/pdf',
            'content-length': String(MAX_BYTES + 1),
          });
          // Only the first bytes, and the response stays open: reading the body would hang.
          response.write(PDF);
          break;
        case '/moved':
          response.writeHead(302, { location: '/files/passport.pdf' });
          response.end();
          break;
        default:
          response.writeHead(404);
          response.end();
      }
    });
    let origin: string;
    // An allowed address nothing listens on.
    let closedOrigin: string;
    // The portal origins the bank takes files from.
    let origins: string[];

    beforeAll(async () => {
      const closed = createServer();
      await new Promise<void>(resolve => {
        closed.listen(0, '127.0.0.1', resolve);
      });
      closedOrigin = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`;
      await new Promise(resolve => {
        closed.close(resolve);
      });

      await new Promise<void>(resolve => {
        portal.listen(0, '127.0.0.1', resolve);
      });
      origin = `http://127.0.0.1:${(portal.address() as AddressInfo).port}`;
    });

    beforeEach(() => {
      origins = [origin, closedOrigin];
    });

    afterAll(async () => {
      portal.closeAllConnections();
      await new Promise(resolve => {
        portal.close(resolve);
      });
    });

    it('should fetch a PDF from the portal and name it from its Content-Disposition', async () => {
      await expect(fetchUpload(` ${origin}/files/passport.pdf `, origins)).resolves.toEqual({
        buffer: PDF,
        mime: 'application/pdf',
        name: 'Passport_scan.pdf',
      });
    });

    it('should name a fetched file from its URL when the portal sends no file name', async () => {
      await expect(fetchUpload(`${origin}/files/bill%20june.png`, origins)).resolves.toMatchObject({
        mime: 'image/png',
        name: 'bill_june.png',
      });
    });

    it('should refuse a value that is not a valid link', async () => {
      expect(await refusal(() => fetchUpload('not a link', origins))).toBe(
        'The file URL is not a valid link.',
      );
      expect(await refusal(() => fetchUpload(undefined, origins))).toBe(
        'The file URL is not a valid link.',
      );
    });

    it('should refuse a link outside the portal origins, naming the refused one only', async () => {
      const { port } = new URL(origin);

      expect(await refusal(() => fetchUpload('https://files.example/passport.pdf', origins))).toBe(
        'Files are only taken from the partner portal, not from https://files.example.',
      );
      // The same server under another name is another origin.
      expect(
        await refusal(() => fetchUpload(`http://localhost:${port}/files/passport.pdf`, origins)),
      ).toBe(`Files are only taken from the partner portal, not from http://localhost:${port}.`);
    });

    it('should take a file from an allowed origin written with a path and in capitals', async () => {
      origins = [`${origin.toUpperCase()}/portal/`];

      await expect(fetchUpload(`${origin}/files/passport.pdf`, origins)).resolves.toMatchObject({
        mime: 'application/pdf',
      });
    });

    it('should name a fetched file from its URL as sent when its escapes are broken', async () => {
      await expect(fetchUpload(`${origin}/files/a%E0%A4%A.pdf`, origins)).resolves.toMatchObject({
        mime: 'application/pdf',
        name: 'a_E0_A4_A.pdf',
      });
    });

    it('should refuse a redirect, even to a file on the portal', async () => {
      expect(await refusal(() => fetchUpload(`${origin}/moved`, origins))).toBe(
        `The partner portal did not hand over the file (${origin}).`,
      );
    });

    it('should refuse when the portal cannot be reached', async () => {
      expect(await refusal(() => fetchUpload(`${closedOrigin}/files/passport.pdf`, origins))).toBe(
        `The partner portal did not hand over the file (${closedOrigin}).`,
      );
    });

    it("should refuse with the portal's status when it does not answer 2xx", async () => {
      expect(await refusal(() => fetchUpload(`${origin}/files/missing.pdf`, origins))).toBe(
        'The partner portal answered 404.',
      );
    });

    it('should refuse a file announced over 5 MB before reading it', async () => {
      expect(await refusal(() => fetchUpload(`${origin}/files/huge.pdf`, origins))).toBe(
        'The file is larger than 5 MB.',
      );
    });

    it('should stop reading a body past 5 MB when no Content-Length announced it', async () => {
      expect(await refusal(() => fetchUpload(`${origin}/files/endless.pdf`, origins))).toBe(
        'The file is larger than 5 MB.',
      );
      expect(endlessEncoding).toBe('identity');
      // An endless body: refused at 5 MB plus what was in flight, not read to the end.
      expect(endlessSent).toBeLessThan(4 * MAX_BYTES);
    });

    it('should refuse when the portal hangs up while sending the file', async () => {
      expect(await refusal(() => fetchUpload(`${origin}/files/hang-up.pdf`, origins))).toBe(
        `The partner portal did not hand over the file (${origin}).`,
      );
    });

    it('should refuse a fetched file that is not a PDF, PNG or JPEG', async () => {
      expect(await refusal(() => fetchUpload(`${origin}/files/notes.pdf`, origins))).toBe(
        'The file is not a PDF, PNG or JPEG.',
      );
    });
  });

  describe('keep', () => {
    const file = (size: number) => ({
      buffer: pdfOf(size),
      mime: 'application/pdf',
      name: 'a.pdf',
    });
    // A kept file's data URI: its prefix, then the base64 of its bytes.
    const uriLength = (size: number) =>
      `data:application/pdf;name=a.pdf;base64,`.length + (size / 3) * 4;

    it('should drop the oldest files first past the number of files kept', () => {
      ['count-1', 'count-2', 'count-3'].forEach(id => keep(id, file(30), { maxFiles: 2 }));

      expect(uploaded('count-1')).toBeNull();
      expect(uploaded('count-2')).toMatchObject({ name: 'a.pdf', size: 30 });
      expect(uploaded('count-3')).toMatchObject({ name: 'a.pdf', size: 30 });
    });

    it('should drop the oldest files first past the bytes kept in all', () => {
      const maxBytes = 2 * uriLength(300);
      ['bytes-1', 'bytes-2', 'bytes-3'].forEach(id => keep(id, file(300), { maxBytes }));

      expect(uploaded('bytes-1')).toBeNull();
      expect(uploaded('bytes-2')).toMatchObject({ size: 300 });
      expect(uploaded('bytes-3')).toMatchObject({ size: 300 });
    });

    it('should keep the file just given, even alone over the bytes kept in all', () => {
      keep('alone', file(300), { maxBytes: 10 });

      expect(uploaded('alone')).toMatchObject({
        size: 300,
        uri: expect.stringMatching(/^data:application\/pdf;name=a\.pdf;base64,JVBERi0x/),
      });
    });
  });
});
