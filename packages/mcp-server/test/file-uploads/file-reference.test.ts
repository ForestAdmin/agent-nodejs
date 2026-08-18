import parseFileReference, { UPLOADED_FILE_PREFIX } from '../../src/file-uploads/file-reference';

describe('parseFileReference', () => {
  it('exposes the sentinel prefix used inside action values', () => {
    expect(UPLOADED_FILE_PREFIX).toBe('$uploadedFile:');
  });

  it('extracts the handle of an upload reference', () => {
    expect(parseFileReference('$uploadedFile:a.b.c')).toBe('a.b.c');
  });

  it.each([
    ['a plain string', 'report.pdf'],
    ['a data uri', 'data:application/pdf;base64,JVBERg=='],
    ['a prefix appearing mid-string', 'see $uploadedFile:token'],
    ['a number', 42],
    ['null', null],
    ['undefined', undefined],
    ['an object', { handle: 'x' }],
  ])('returns null for %s', (_, value) => {
    expect(parseFileReference(value)).toBeNull();
  });
});
