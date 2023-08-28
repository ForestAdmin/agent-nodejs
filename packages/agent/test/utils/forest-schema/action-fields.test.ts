import { ActionFieldTypeList } from '@forestadmin/datasource-toolkit';

import ActionFields from '../../../src/utils/forest-schema/action-fields';

describe('ActionFields', () => {
  describe('isCollectionField', () => {
    it('should return true when the field type is Collection', () => {
      const result = ActionFields.isCollectionField({
        type: 'Collection',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(true);
    });

    it.each(ActionFieldTypeList.filter(type => type !== 'Collection'))(
      'should return false when the field type is %s',
      type => {
        const result = ActionFields.isCollectionField({
          type,
          label: 'Label',
          watchChanges: false,
        });

        expect(result).toBe(false);
      },
    );

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isCollectionField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isEnumField', () => {
    it('should return true when the field type is Enum', () => {
      const result = ActionFields.isEnumField({
        type: 'Enum',
        label: 'Label',
        watchChanges: false,
        enumValues: ['value1', 'value2'],
      });

      expect(result).toBe(true);
    });

    it.each(ActionFieldTypeList.filter(type => type !== 'Enum'))(
      'should return false when the field type is %s',
      type => {
        const result = ActionFields.isEnumField({
          type,
          label: 'Label',
          watchChanges: false,
        });

        expect(result).toBe(false);
      },
    );

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isEnumField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isEnumListField', () => {
    it('should return true when the field type is EnumList', () => {
      const result = ActionFields.isEnumListField({
        type: 'EnumList',
        label: 'Label',
        watchChanges: false,
        enumValues: ['value1', 'value2'],
      });

      expect(result).toBe(true);
    });

    it.each(ActionFieldTypeList.filter(type => type !== 'EnumList'))(
      'should return false when the field type is %s',
      type => {
        const result = ActionFields.isEnumListField({
          type,
          label: 'Label',
          watchChanges: false,
        });

        expect(result).toBe(false);
      },
    );

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isEnumListField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isFileField', () => {
    it('should return true when the field type is File', () => {
      const result = ActionFields.isFileField({
        type: 'File',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(true);
    });

    it.each(ActionFieldTypeList.filter(type => type !== 'File'))(
      'should return false when the field type is %s',
      type => {
        const result = ActionFields.isFileField({
          type,
          label: 'Label',
          watchChanges: false,
        });

        expect(result).toBe(false);
      },
    );

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isFileField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isFileListField', () => {
    it('should return true when the field type is FileList', () => {
      const result = ActionFields.isFileListField({
        type: 'FileList',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(true);
    });

    it.each(ActionFieldTypeList.filter(type => type !== 'FileList'))(
      'should return false when the field type is %s',
      type => {
        const result = ActionFields.isFileListField({
          type,
          label: 'Label',
          watchChanges: false,
        });

        expect(result).toBe(false);
      },
    );

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isFileListField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('isDropdownField', () => {
    it('should return true when the field type is Dropdown', () => {
      const result = ActionFields.isDropdownField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
      });

      expect(result).toBe(true);
    });

    it('should return false when the field type is not Dropdown', () => {
      const result = ActionFields.isDropdownField({
        type: 'String',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(false);
    });

    it('should return false when the field is undefined', () => {
      const result = ActionFields.isDropdownField(undefined);

      expect(result).toBe(false);
    });
  });

  describe('hasWidget', () => {
    it('should return true when the field has a widget', () => {
      const result = ActionFields.hasWidget({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        // @ts-expect-error widget could be anything at this point
        widget: 'ANY',
      });

      expect(result).toBe(true);
    });

    it('should return false when the field has no widget', () => {
      const result = ActionFields.hasWidget({
        type: 'String',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBe(false);
    });

    it('should return false when the field is undefined', () => {
      const result = ActionFields.hasWidget(undefined);

      expect(result).toBe(false);
    });
  });
});
