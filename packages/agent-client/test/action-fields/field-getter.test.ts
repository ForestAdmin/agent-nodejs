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

  describe('getEffectiveTypeName', () => {
    const filePicker = { name: 'file picker', parameters: { static: {} } };

    it('should map a String carrying the file picker widget to File', () => {
      const fieldGetter = new FieldGetter(
        createPlainField({ type: 'String', widgetEdit: filePicker }),
      );

      expect(fieldGetter.getEffectiveTypeName()).toBe('File');
      expect(fieldGetter.getTypeName()).toBe('String');
    });

    it('should map a String list carrying the file picker widget to FileList', () => {
      const fieldGetter = new FieldGetter(
        createPlainField({ type: ['String'], widgetEdit: filePicker }),
      );

      expect(fieldGetter.getEffectiveTypeName()).toBe('FileList');
      expect(fieldGetter.getTypeName()).toBe('StringList');
    });

    it('should leave a String without the file picker widget untouched', () => {
      expect(new FieldGetter(createPlainField({ type: 'String' })).getEffectiveTypeName()).toBe(
        'String',
      );
      expect(
        new FieldGetter(
          createPlainField({
            type: 'String',
            widgetEdit: { name: 'text area editor', parameters: { static: {} } },
          }),
        ).getEffectiveTypeName(),
      ).toBe('String');
    });

    it('should leave a String untouched on the null widgetEdit the saas stores', () => {
      const plainField = {
        ...createPlainField({ type: 'String' }),
        widgetEdit: null,
      } as unknown as PlainField;

      expect(new FieldGetter(plainField).getEffectiveTypeName()).toBe('String');
    });

    it('should leave a non String type untouched even with the file picker widget', () => {
      const fieldGetter = new FieldGetter(
        createPlainField({ type: 'Number', widgetEdit: filePicker }),
      );

      expect(fieldGetter.getEffectiveTypeName()).toBe('Number');
    });

    it('should leave an Enum untouched', () => {
      const fieldGetter = new FieldGetter(
        createPlainField({ type: 'Enum', enums: ['passport', 'id_card'] }),
      );

      expect(fieldGetter.getEffectiveTypeName()).toBe('Enum');
      expect(fieldGetter.getTypeName()).toBe('Enum');
    });

    it('should report a native File as File and a native File list as FileList', () => {
      expect(new FieldGetter(createPlainField({ type: 'File' })).getEffectiveTypeName()).toBe(
        'File',
      );
      expect(new FieldGetter(createPlainField({ type: ['File'] })).getEffectiveTypeName()).toBe(
        'FileList',
      );
    });
  });
});
