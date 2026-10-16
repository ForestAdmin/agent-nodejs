import parameterize from '../../src/utils/partiql';

describe('parameterize', () => {
  it('replaces placeholders by positional parameters, in order, repeats included', () => {
    expect(
      parameterize('SELECT * FROM "T" WHERE a = $x AND b = $y AND c = $x', { x: 1, y: 'z' }),
    ).toEqual({
      statement: 'SELECT * FROM "T" WHERE a = ? AND b = ? AND c = ?',
      parameters: [1, 'z', 1],
    });
  });

  it('leaves a placeholder inside a string literal alone', () => {
    expect(parameterize('SELECT * FROM "T" WHERE name = \'$name\'', {})).toEqual({
      statement: 'SELECT * FROM "T" WHERE name = \'$name\'',
      parameters: [],
    });
  });

  it('leaves a placeholder inside a quoted identifier alone', () => {
    expect(parameterize('SELECT "$cost" FROM "T" WHERE a = $a', { a: 1 })).toEqual({
      statement: 'SELECT "$cost" FROM "T" WHERE a = ?',
      parameters: [1],
    });
  });

  it('keeps reading a literal past an escaped quote', () => {
    expect(parameterize("SELECT * FROM \"T\" WHERE a = 'it''s $x' AND b = $y", { y: 2 })).toEqual({
      statement: "SELECT * FROM \"T\" WHERE a = 'it''s $x' AND b = ?",
      parameters: [2],
    });
  });

  it('refuses a placeholder without value', () => {
    expect(() => parameterize('SELECT * FROM "T" WHERE a = $missing', {})).toThrow(
      'No value was given for the placeholder $missing',
    );
  });

  it('keeps a lone dollar sign', () => {
    expect(parameterize('SELECT * FROM "T" WHERE a = $ AND b = $1', { 1: 'x' })).toEqual({
      statement: 'SELECT * FROM "T" WHERE a = $ AND b = ?',
      parameters: ['x'],
    });
  });
});
