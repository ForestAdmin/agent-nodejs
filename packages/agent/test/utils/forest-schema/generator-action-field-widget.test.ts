import GeneratorActionFieldWidget from '../../../src/utils/forest-schema/generator-action-field-widget';

describe('GeneratorActionFieldWidget', () => {
  describe('buildWidgetEdit', () => {
    it('should return null when field has no widget', () => {
      const result = GeneratorActionFieldWidget.buildWidgetOptions({
        type: 'String',
        label: 'Label',
        watchChanges: false,
      });

      expect(result).toBeUndefined();
    });

    it('should return null when the field type is Collection', () => {
      const result = GeneratorActionFieldWidget.buildWidgetOptions({
        type: 'Collection',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
      });

      expect(result).toBeUndefined();
    });

    it('should return null when the field type is Enum', () => {
      const result = GeneratorActionFieldWidget.buildWidgetOptions({
        type: 'Enum',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        enumValues: ['value1', 'value2'],
      });

      expect(result).toBeUndefined();
    });

    it('should return null when the field type is EnumList', () => {
      const result = GeneratorActionFieldWidget.buildWidgetOptions({
        type: 'EnumList',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
        enumValues: ['value1', 'value2'],
      });

      expect(result).toBeUndefined();
    });

    describe('Dropdown', () => {
      it('should return a valid widget edit', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'Dropdown',
          options: [
            { value: 'value1', label: 'Value 1' },
            { value: 'value2', label: 'Value 2' },
          ],
          search: 'static',
          placeholder: 'Placeholder',
        });

        expect(result).toEqual({
          name: 'dropdown',
          parameters: {
            isSearchable: true,
            options: [
              { value: 'value1', label: 'Value 1' },
              { value: 'value2', label: 'Value 2' },
            ],
            placeholder: 'Placeholder',
          },
        });
      });

      it('should return a valid configuration with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'Dropdown',
        });

        expect(result).toEqual({
          name: 'dropdown',
          parameters: {
            isSearchable: false,
            options: [],
            placeholder: null,
          },
        });
      });
    });

    it('should throw an error when the widget is not supported', () => {
      expect(() => {
        GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          // @ts-expect-error Unsupported widget
          widget: 'UnsupportedWidget',
        });
      }).toThrow('Unsupported widget type: UnsupportedWidget');
    });
  });
});
