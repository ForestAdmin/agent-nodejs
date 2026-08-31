import { recordKey } from '../../src/openapi/record-schemas';

describe('recordKey', () => {
  it('should leave an already-clean name untouched', () => {
    expect(recordKey('email')).toBe('email');
  });

  it('should camelCase a snake_case name, since that is how the response carries it', () => {
    expect(recordKey('created_at')).toBe('createdAt');
  });

  it('should collapse every casing and separator variant onto one key, like the deserializer', () => {
    ['first_name', 'firstName', 'FirstName', 'first-name', 'FIRST_NAME'].forEach(name => {
      expect(recordKey(name)).toBe('firstName');
    });
  });

  it('should camelize non-ASCII names too, which a hand-rolled mirror would likely miss', () => {
    expect(recordKey('état_civil')).toBe('étatCivil');
  });
});
