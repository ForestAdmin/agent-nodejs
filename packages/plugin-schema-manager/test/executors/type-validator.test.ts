import { TypeValidator } from '../../src/validators/type-validator';

describe('TypeValidator', () => {
  let validator: TypeValidator;

  beforeEach(() => {
    validator = new TypeValidator();
  });

  describe('validateType', () => {
    it('should accept supported types', () => {
      const supportedTypes = ['STRING', 'INTEGER', 'BOOLEAN', 'DATE'];

      for (const type of supportedTypes) {
        const result = validator.validateType(type, supportedTypes);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject unsupported types', () => {
      const result = validator.validateType('UNKNOWN_TYPE', ['STRING', 'INTEGER']);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('not supported');
    });

    it('should be case-insensitive', () => {
      const result = validator.validateType('string', ['STRING', 'INTEGER']);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateTypeChange', () => {
    it('should allow same type change', () => {
      const result = validator.validateTypeChange('STRING', 'STRING');

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringContaining('Same type'));
    });

    it('should allow safe string expansions', () => {
      const safeChanges = [
        ['CHAR', 'VARCHAR'],
        ['VARCHAR', 'TEXT'],
        ['STRING', 'TEXT'],
      ];

      for (const [from, to] of safeChanges) {
        const result = validator.validateTypeChange(from, to);
        expect(result.isValid).toBe(true);
      }
    });

    it('should allow safe numeric upscaling', () => {
      const safeChanges = [
        ['INTEGER', 'BIGINT'],
        ['INTEGER', 'FLOAT'],
        ['FLOAT', 'DOUBLE'],
      ];

      for (const [from, to] of safeChanges) {
        const result = validator.validateTypeChange(from, to);
        expect(result.isValid).toBe(true);
      }
    });

    it('should warn about text truncation', () => {
      const result = validator.validateTypeChange('TEXT', 'VARCHAR');

      expect(result.isValid).toBe(true);
      expect(result.warnings?.some(w => w.includes('truncate'))).toBe(true);
    });

    it('should warn about numeric overflow', () => {
      const result = validator.validateTypeChange('BIGINT', 'INTEGER');

      expect(result.isValid).toBe(true);
      expect(result.warnings?.some(w => w.includes('overflow'))).toBe(true);
    });

    it('should warn about precision loss', () => {
      const result = validator.validateTypeChange('DOUBLE', 'INTEGER');

      expect(result.isValid).toBe(true);
      expect(result.warnings?.some(w => w.includes('decimal'))).toBe(true);
    });

    it('should suggest backup for risky conversions', () => {
      const result = validator.validateTypeChange('STRING', 'INTEGER');

      expect(result.warnings?.some(w => w.includes('backing up'))).toBe(true);
    });
  });

  describe('validateDefaultValue', () => {
    it('should accept null/undefined', () => {
      const result1 = validator.validateDefaultValue(null, 'STRING');
      const result2 = validator.validateDefaultValue(undefined, 'STRING');

      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
    });

    describe('INTEGER type', () => {
      it('should accept integer values', () => {
        const result = validator.validateDefaultValue(42, 'INTEGER');
        expect(result.isValid).toBe(true);
      });

      it('should reject non-integers', () => {
        const result = validator.validateDefaultValue(42.5, 'INTEGER');
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('not a valid integer');
      });

      it('should reject strings', () => {
        const result = validator.validateDefaultValue('abc', 'INTEGER');
        expect(result.isValid).toBe(false);
      });
    });

    describe('FLOAT/DOUBLE type', () => {
      it('should accept numeric values', () => {
        const result1 = validator.validateDefaultValue(42.5, 'FLOAT');
        const result2 = validator.validateDefaultValue(100, 'DOUBLE');

        expect(result1.isValid).toBe(true);
        expect(result2.isValid).toBe(true);
      });

      it('should reject non-numeric values', () => {
        const result = validator.validateDefaultValue('not a number', 'FLOAT');
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('not a valid number');
      });
    });

    describe('BOOLEAN type', () => {
      it('should accept boolean values', () => {
        const result1 = validator.validateDefaultValue(true, 'BOOLEAN');
        const result2 = validator.validateDefaultValue(false, 'BOOLEAN');

        expect(result1.isValid).toBe(true);
        expect(result2.isValid).toBe(true);
      });

      it('should accept boolean-like values', () => {
        const result1 = validator.validateDefaultValue('true', 'BOOLEAN');
        const result2 = validator.validateDefaultValue(1, 'BOOLEAN');
        const result3 = validator.validateDefaultValue(0, 'BOOLEAN');

        expect(result1.isValid).toBe(true);
        expect(result2.isValid).toBe(true);
        expect(result3.isValid).toBe(true);
      });

      it('should reject invalid boolean values', () => {
        const result = validator.validateDefaultValue('maybe', 'BOOLEAN');
        expect(result.isValid).toBe(false);
      });
    });

    describe('DATE type', () => {
      it('should accept Date objects', () => {
        const result = validator.validateDefaultValue(new Date(), 'DATE');
        expect(result.isValid).toBe(true);
      });

      it('should accept valid date strings', () => {
        const result = validator.validateDefaultValue('2023-01-01', 'DATE');
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid date strings', () => {
        const result = validator.validateDefaultValue('not a date', 'DATE');
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('not a valid date');
      });
    });

    describe('JSON type', () => {
      it('should accept valid JSON objects', () => {
        const result = validator.validateDefaultValue({ key: 'value' }, 'JSON');
        expect(result.isValid).toBe(true);
      });

      it('should accept valid JSON strings', () => {
        const result = validator.validateDefaultValue('{"key":"value"}', 'JSON');
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid JSON strings', () => {
        const result = validator.validateDefaultValue('{invalid json}', 'JSON');
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('not valid JSON');
      });
    });

    describe('UUID type', () => {
      it('should accept valid UUIDs', () => {
        const result = validator.validateDefaultValue(
          '550e8400-e29b-41d4-a716-446655440000',
          'UUID',
        );
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid UUIDs', () => {
        const result = validator.validateDefaultValue('not-a-uuid', 'UUID');
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('not a valid UUID');
      });
    });

    describe('STRING type', () => {
      it('should accept any string value', () => {
        const result = validator.validateDefaultValue('any string', 'STRING');
        expect(result.isValid).toBe(true);
      });

      it('should accept numbers as strings', () => {
        const result = validator.validateDefaultValue(123, 'STRING');
        expect(result.isValid).toBe(true);
      });
    });
  });
});
