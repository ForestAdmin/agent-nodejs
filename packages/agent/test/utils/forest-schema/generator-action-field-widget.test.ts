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
      // @ts-expect-error Collection type does not support widget
      const result = GeneratorActionFieldWidget.buildWidgetOptions({
        type: 'Collection',
        label: 'Label',
        watchChanges: false,
        widget: 'Dropdown',
      });

      expect(result).toBeUndefined();
    });

    it('should return null when the field type is Enum', () => {
      // @ts-expect-error Collection type does not support widget
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
      // @ts-expect-error Collection type does not support widget
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
            placeholder: 'Placeholder',
            static: {
              options: [
                { value: 'value1', label: 'Value 1' },
                { value: 'value2', label: 'Value 2' },
              ],
            },
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
            placeholder: null,
            static: {
              options: [],
            },
          },
        });
      });
    });

    describe('RadioGroup', () => {
      it('should return a valid widget edit', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'RadioGroup',
          options: [
            { value: 'value1', label: 'Value 1' },
            { value: 'value2', label: 'Value 2' },
          ],
        });

        expect(result).toEqual({
          name: 'radio button',
          parameters: {
            static: {
              options: [
                { value: 'value1', label: 'Value 1' },
                { value: 'value2', label: 'Value 2' },
              ],
            },
          },
        });
      });

      it('should return a valid configuration with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'RadioGroup',
        });

        expect(result).toEqual({
          name: 'radio button',
          parameters: {
            static: {
              options: [],
            },
          },
        });
      });
    });

    describe('CheckboxGroup', () => {
      it('should return a valid widget edit', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'StringList',
          label: 'Label',
          watchChanges: false,
          widget: 'CheckboxGroup',
          options: [
            { value: 'value1', label: 'Value 1' },
            { value: 'value2', label: 'Value 2' },
          ],
        });

        expect(result).toEqual({
          name: 'checkboxes',
          parameters: {
            static: {
              options: [
                { value: 'value1', label: 'Value 1' },
                { value: 'value2', label: 'Value 2' },
              ],
            },
          },
        });
      });

      it('should return a valid configuration with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'StringList',
          label: 'Label',
          watchChanges: false,
          widget: 'CheckboxGroup',
        });

        expect(result).toEqual({
          name: 'checkboxes',
          parameters: {
            static: {
              options: [],
            },
          },
        });
      });
    });

    describe('Checkbox', () => {
      it('should return a valid widget edit', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'Boolean',
          label: 'Label',
          watchChanges: false,
          widget: 'Checkbox',
        });

        expect(result).toEqual({
          name: 'boolean editor',
          parameters: {},
        });
      });
    });

    describe('TextInput', () => {
      it('should generate a default text input', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'TextInput',
        });

        expect(result).toEqual({
          name: 'text editor',
          parameters: {
            placeholder: null,
          },
        });
      });

      it('should add the placeholder if present', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'TextInput',
          placeholder: 'Placeholder',
        });

        expect(result).toEqual({
          name: 'text editor',
          parameters: {
            placeholder: 'Placeholder',
          },
        });
      });
    });

    describe('TextInputList', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'StringList',
          label: 'Label',
          watchChanges: false,
          widget: 'TextInputList',
        });

        expect(result).toEqual({
          name: 'input array',
          parameters: {
            placeholder: null,
            allowDuplicate: false,
            allowEmptyValue: false,
            enableReorder: true,
          },
        });
      });

      it('should pass the options to the widget', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'StringList',
          label: 'Label',
          watchChanges: false,
          widget: 'TextInputList',
          placeholder: 'Placeholder',
          allowDuplicates: true,
          allowEmptyValues: true,
          enableReorder: false,
        });

        expect(result).toEqual({
          name: 'input array',
          parameters: {
            placeholder: 'Placeholder',
            allowDuplicate: true,
            allowEmptyValue: true,
            enableReorder: false,
          },
        });
      });
    });

    describe('TextArea', () => {
      it('should return a valid and empty widget edit', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'TextArea',
        });

        expect(result).toEqual({
          name: 'text area editor',
          parameters: {
            placeholder: null,
            rows: null,
          },
        });
      });

      it('should return a valid widget edit with placeholder', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'TextArea',
          placeholder: 'Placeholder',
        });

        expect(result).toMatchObject({
          parameters: {
            placeholder: 'Placeholder',
          },
        });
      });

      describe('rows', () => {
        it('should return a valid widget edit with rows', () => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'String',
            label: 'Label',
            watchChanges: false,
            widget: 'TextArea',
            rows: 10,
          });

          expect(result).toMatchObject({
            parameters: {
              rows: 10,
            },
          });
        });

        it.each([0, -1, null, 'foo'])(
          `should return a valid widget edit with rows = null when rows is %s`,
          rows => {
            const result = GeneratorActionFieldWidget.buildWidgetOptions({
              type: 'String',
              label: 'Label',
              watchChanges: false,
              widget: 'TextArea',
              rows: rows as number,
            });

            expect(result).toMatchObject({
              parameters: {
                rows: null,
              },
            });
          },
        );

        it('should round the rows value', () => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'String',
            label: 'Label',
            watchChanges: false,
            widget: 'TextArea',
            rows: 1.5,
          });

          expect(result).toMatchObject({
            parameters: {
              rows: 2,
            },
          });
        });
      });
    });

    describe('RichText', () => {
      it('should return a valid widget edit', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'RichText',
        });

        expect(result).toMatchObject({
          name: 'rich text',
          parameters: {
            placeholder: null,
          },
        });
      });

      it('should return a valid widget edit with placeholder', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'RichText',
          placeholder: 'Placeholder',
        });

        expect(result).toMatchObject({
          parameters: {
            placeholder: 'Placeholder',
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
