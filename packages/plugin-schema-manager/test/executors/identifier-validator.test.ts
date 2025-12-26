import { IdentifierValidator } from '../../src/validators/identifier-validator';

describe('IdentifierValidator', () => {
  let validator: IdentifierValidator;

  beforeEach(() => {
    validator = new IdentifierValidator();
  });

  describe('validateIdentifier', () => {
    it('should accept valid identifiers', () => {
      const validNames = [
        'user_id',
        'UserTable',
        '_private',
        'table123',
        'a',
        'TABLE_NAME_WITH_UNDERSCORES',
      ];

      for (const name of validNames) {
        const result = validator.validateIdentifier(name);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject empty identifiers', () => {
      const result = validator.validateIdentifier('');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('empty');
    });

    it('should reject identifiers that are too long', () => {
      const longName = 'a'.repeat(64);
      const result = validator.validateIdentifier(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('too long');
    });

    it('should reject identifiers starting with a number', () => {
      const result = validator.validateIdentifier('123table');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('cannot start with a number'));
    });

    it('should reject identifiers with special characters', () => {
      const invalidNames = ['user-id', 'user.id', 'user id', 'user@id', 'user#id'];

      for (const name of invalidNames) {
        const result = validator.validateIdentifier(name);
        expect(result.isValid).toBe(false);
      }
    });

    it('should reject SQL injection attempts', () => {
      const dangerousNames = [
        "user'; DROP TABLE users--",
        'user" OR 1=1',
        'user/* comment */',
        'user--comment',
      ];

      for (const name of dangerousNames) {
        const result = validator.validateIdentifier(name);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('dangerous'))).toBe(true);
      }
    });

    it('should warn about reserved SQL keywords', () => {
      const reservedWords = ['SELECT', 'FROM', 'WHERE', 'TABLE', 'DROP'];

      for (const word of reservedWords) {
        const result = validator.validateIdentifier(word);
        // In non-strict mode, should warn but allow
        expect(result.warnings && result.warnings.length > 0).toBe(true);
      }
    });

    it('should reject reserved words in strict mode', () => {
      const result = validator.validateIdentifier('SELECT', true);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('reserved'))).toBe(true);
    });
  });

  describe('validateTableName', () => {
    it('should reject forbidden tables', () => {
      const forbiddenTables = ['users', 'admin', 'sessions'];
      const result = validator.validateTableName('users', forbiddenTables);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('protected');
    });
  });

  describe('validateColumnName', () => {
    it('should reject forbidden columns', () => {
      const forbiddenColumns = ['id', 'password'];
      const result = validator.validateColumnName('id', forbiddenColumns);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('protected');
    });
  });

  describe('validateIdentifiers', () => {
    it('should validate multiple identifiers', () => {
      const names = ['valid_name', '123invalid', 'another_valid'];
      const result = validator.validateIdentifiers(names);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('123invalid');
    });

    it('should return all valid when all identifiers are valid', () => {
      const names = ['name1', 'name2', 'name3'];
      const result = validator.validateIdentifiers(names);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
