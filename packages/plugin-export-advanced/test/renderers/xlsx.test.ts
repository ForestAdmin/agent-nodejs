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
});
