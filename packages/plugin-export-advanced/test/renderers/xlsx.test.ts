import { toCell } from '../../src/renderers/xlsx';

describe('xlsx toCell', () => {
  test.each([
    ['true', true],
    ['false', false],
  ])('casts the boolean string "%s" to a boolean cell', (input, expected) => {
    expect(toCell(input)).toStrictEqual({ type: Boolean, value: expected });
  });

  test('casts a numeric string to a number cell', () => {
    expect(toCell('42')).toStrictEqual({ type: Number, value: 42 });
  });

  test('casts a non-primitive value to a string cell', () => {
    expect(toCell({ foo: 'bar' })).toStrictEqual({ type: String, value: '[object Object]' });
  });

  // A non-finite number would ship as <v>NaN</v>/<v>Infinity</v> and make Excel repair the file.
  test('falls back to a string cell for a non-finite number', () => {
    expect(toCell(NaN)).toStrictEqual({ type: String, value: 'NaN' });
    expect(toCell(Infinity)).toStrictEqual({ type: String, value: 'Infinity' });
  });

  test('drops an invalid Date to an empty cell', () => {
    expect(toCell(new Date('nope'))).toBeNull();
  });

  test.each(['Infinity', '1e309'])('keeps the non-finite numeric string "%s" as text', input => {
    expect(toCell(input)).toStrictEqual({ type: String, value: input });
  });
});
