import parseArray from '../../../../src/introspection/dialects/postgresql-dialect/parse-array';

describe('PostgreSQL: parseArray', () => {
  it.each([
    [null, null],
    ['', null],
    ['{}', []],
    ['{1}', ['1']],
    ['{1,2}', ['1', '2']],
    ['{1,"with,character"}', ['1', 'with,character']],
    ["{1,with''character}", ['1', "with'character"]],
    ['{1,with\\"character}', ['1', 'with"character']],
    ['{1,"what,a\'\'\\"mess"}', ['1', 'what,a\'"mess']],
  ])(`should parse %s as %s`, (value, expected) => {
    expect(parseArray(value)).toEqual(expected);
  });
});
