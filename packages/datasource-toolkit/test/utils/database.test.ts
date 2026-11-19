import { MAX_DATABASE_NAME_LENGTH, makeDatabaseEntry } from '../../src';

describe('makeDatabaseEntry', () => {
  it('keeps a well-formed name', () => {
    expect(makeDatabaseEntry('postgres', 'mydb')).toStrictEqual({ type: 'postgres', name: 'mydb' });
  });

  it('trims the name', () => {
    expect(makeDatabaseEntry('postgres', '  mydb  ')).toStrictEqual({
      type: 'postgres',
      name: 'mydb',
    });
  });

  it('keeps a name of exactly the maximum length', () => {
    expect(makeDatabaseEntry('postgres', 'a'.repeat(MAX_DATABASE_NAME_LENGTH)).name).toBe(
      'a'.repeat(MAX_DATABASE_NAME_LENGTH),
    );
  });

  it('drops a name one character over the maximum length', () => {
    expect(makeDatabaseEntry('postgres', 'a'.repeat(MAX_DATABASE_NAME_LENGTH + 1))).toStrictEqual({
      type: 'postgres',
      name: null,
    });
  });

  it.each([
    ['an empty string', ''],
    ['a blank string', '   '],
    ['null', null],
    ['undefined', undefined],
    ['a non-string', 42],
  ])('drops %s', (_message, name) => {
    expect(makeDatabaseEntry('postgres', name as string | null)).toStrictEqual({
      type: 'postgres',
      name: null,
    });
  });
});
