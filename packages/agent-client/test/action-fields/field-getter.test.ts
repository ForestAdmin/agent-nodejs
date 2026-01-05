import type { PlainField } from '../../src/action-fields/types';

import FieldGetter from '../../src/action-fields/field-getter';

describe('FieldGetter', () => {
  const createPlainField = (overrides: Partial<PlainField> = {}): PlainField => ({
    field: 'testField',
    type: 'String',
    isRequired: false,
    isReadOnly: false,
    value: 'test value',
    ...overrides,
  });

  describe('constructor', () => {
    it('should store the plain field', () => {
      const plainField = createPlainField();
      const fieldGetter = new FieldGetter(plainField);

      expect(fieldGetter.getPlainField()).toBe(plainField);
    });
  });

  describe('getPlainField', () => {
    it('should return the stored plain field', () => {
      const plainField = createPlainField({ field: 'myField' });
      const fieldGetter = new FieldGetter(plainField);

      expect(fieldGetter.getPlainField()).toEqual(plainField);
    });
  });

  describe('getValue', () => {
    it('should return the value from the plain field', () => {
      const fieldGetter = new FieldGetter(createPlainField({ value: 'hello world' }));

      expect(fieldGetter.getValue()).toBe('hello world');
    });

    it('should return undefined when value is not set', () => {
      const fieldGetter = new FieldGetter(createPlainField({ value: undefined }));

      expect(fieldGetter.getValue()).toBeUndefined();
    });

    it('should return null when value is null', () => {
      const fieldGetter = new FieldGetter(createPlainField({ value: null }));

      expect(fieldGetter.getValue()).toBeNull();
    });
  });

  describe('getName', () => {
    it('should return the field name', () => {
      const fieldGetter = new FieldGetter(createPlainField({ field: 'username' }));

      expect(fieldGetter.getName()).toBe('username');
    });
  });

  describe('getType', () => {
    it('should return the field type', () => {
      const fieldGetter = new FieldGetter(createPlainField({ type: 'Number' }));

      expect(fieldGetter.getType()).toBe('Number');
    });

    it('should return different types', () => {
      expect(new FieldGetter(createPlainField({ type: 'Boolean' })).getType()).toBe('Boolean');
      expect(new FieldGetter(createPlainField({ type: 'Date' })).getType()).toBe('Date');
      expect(new FieldGetter(createPlainField({ type: 'Json' })).getType()).toBe('Json');
    });
  });
});
