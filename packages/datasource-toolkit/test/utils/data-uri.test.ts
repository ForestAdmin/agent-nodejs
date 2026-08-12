import { ValidationError } from '../../src/errors';
import { isDataUri, makeDataUri, parseDataUri } from '../../src/utils/data-uri';

describe('DataUri', () => {
  describe('isDataUri', () => {
    it.each([
      ['data:text/plain;base64,aGk=', true],
      ['https://example.com/file.pdf', false],
      ['$uploadedFile:token', false],
      [42, false],
      [null, false],
      [undefined, false],
    ])('answers %p for %p', (value, expected) => {
      expect(isDataUri(value)).toBe(expected);
    });
  });

  describe('makeDataUri', () => {
    it('encodes a file without media types', () => {
      const uri = makeDataUri({ mimeType: 'text/plain', buffer: Buffer.from('hi'), name: '' });

      expect(uri).toBe('data:text/plain;base64,aGk=');
    });

    it('percent-encodes the name so it cannot break the header parsing', () => {
      const uri = makeDataUri({
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF'),
        name: 'rapport final;v2,def.pdf',
      });

      expect(uri).toBe(
        `data:application/pdf;name=rapport%20final%3Bv2%2Cdef.pdf;base64,${Buffer.from(
          '%PDF',
        ).toString('base64')}`,
      );
    });

    it('encodes the charset when it is set', () => {
      const uri = makeDataUri({
        mimeType: 'text/csv',
        buffer: Buffer.from('a,b'),
        name: 'data.csv',
        charset: 'utf-8',
      });

      expect(uri).toBe(
        `data:text/csv;name=data.csv;charset=utf-8;base64,${Buffer.from('a,b').toString('base64')}`,
      );
    });

    it('omits media types that are empty instead of emitting them as undefined', () => {
      const uri = makeDataUri({
        mimeType: 'text/plain',
        buffer: Buffer.from('hi'),
        name: 'note.txt',
        charset: undefined,
      });

      expect(uri).toBe('data:text/plain;name=note.txt;base64,aGk=');
      expect(uri).not.toContain('charset');
    });

    it('returns null when there is no file', () => {
      expect(makeDataUri(null)).toBeNull();
    });
  });

  describe('parseDataUri', () => {
    it('decodes the mime type and the buffer', () => {
      const file = parseDataUri('data:text/plain;base64,aGk=');

      expect(file.mimeType).toBe('text/plain');
      expect(file.buffer.toString()).toBe('hi');
    });

    it('percent-decodes the media types', () => {
      const file = parseDataUri('data:text/plain;name=rapport%20final.txt;base64,aGk=');

      expect(file.name).toBe('rapport final.txt');
    });

    it('returns null when there is no data uri', () => {
      expect(parseDataUri(null)).toBeNull();
    });

    it.each([
      ['a plain filename', 'report.pdf'],
      ['an upload sentinel', '$uploadedFile:eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig'],
      ['an http url', 'https://example.com/f.pdf'],
    ])('rejects %s with a readable message instead of a TypeError', (_, value) => {
      expect(() => parseDataUri(value)).toThrow('A file value must be a data uri');
    });

    // A bare Error surfaces as a generic 500 at the agent boundary, hiding the message.
    it('throws a ValidationError so the message reaches the caller', () => {
      expect(() => parseDataUri('report.pdf')).toThrow(ValidationError);
    });
  });

  describe('round trip', () => {
    it.each([
      'simple.pdf',
      'rapport final.txt',
      'facture;2026,janvier.pdf',
      'reçu-café.png',
      'a=b&c.txt',
    ])('preserves the name %p', name => {
      const file = { mimeType: 'application/octet-stream', buffer: Buffer.from([1, 2, 3]), name };

      const parsed = parseDataUri(makeDataUri(file));

      expect(parsed.name).toBe(name);
      expect(parsed.buffer).toEqual(file.buffer);
      expect(parsed.mimeType).toBe(file.mimeType);
    });
  });
});
