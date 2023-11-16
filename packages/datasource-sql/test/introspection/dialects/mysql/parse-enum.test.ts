import parseEnum from '../../../../src/introspection/dialects/mysql-dialect/parse-enum';

describe('MySQL: parseEnum', () => {
  it.each([
    [null, null],
    ['', null],
    ['VACHAR(255)', null],
    ['ENUM()', []],
    ["ENUM('enum1')", ['enum1']],
    ["ENUM('enum1','enum2')", ['enum1', 'enum2']],
    ["ENUM('enum1','bug,''y\"value')", ['enum1', 'bug,\'y"value']],
  ])(`should parse %s as %s`, (value, expected) => {
    expect(parseEnum(value)).toEqual(expected);
  });
});
