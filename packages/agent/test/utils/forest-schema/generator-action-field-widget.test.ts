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
            searchType: null,
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

      it('should include the searchType="dynamic"', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'Dropdown',
          options: ['1', '2'],
          search: 'dynamic',
          placeholder: 'Placeholder',
        });

        expect(result).toEqual({
          name: 'dropdown',
          parameters: {
            isSearchable: true,
            searchType: 'dynamic',
            placeholder: 'Placeholder',
            static: {
              options: ['1', '2'],
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
            searchType: null,
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

    describe('NumberInput', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'Number',
          label: 'Label',
          watchChanges: false,
          widget: 'NumberInput',
        });

        expect(result).toMatchObject({
          name: 'number input',
          parameters: {
            placeholder: null,
            min: null,
            max: null,
            step: null,
          },
        });
      });

      it('should return a valid widget edit with placeholder', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'Number',
          label: 'Label',
          watchChanges: false,
          widget: 'NumberInput',
          placeholder: 'Placeholder',
        });

        expect(result).toMatchObject({
          parameters: {
            placeholder: 'Placeholder',
          },
        });
      });

      describe.each(['min', 'max', 'step'])('%s', parameter => {
        it.each([undefined, null, 'foo'])(`should return null when ${parameter} is %s`, value => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'Number',
            label: 'Label',
            watchChanges: false,
            widget: 'NumberInput',
            [parameter]: value as unknown as number,
          });

          expect(result).toMatchObject({
            parameters: {
              [parameter]: null,
            },
          });
        });
      });
    });

    describe('NumberInputList', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'NumberList',
          label: 'Label',
          watchChanges: false,
          widget: 'NumberInputList',
        });

        expect(result).toMatchObject({
          name: 'input array',
          parameters: {
            placeholder: null,
            allowDuplicate: false,
            enableReorder: true,
            min: null,
            max: null,
            step: null,
          },
        });
      });

      it.each([
        { property: 'placeholder', value: 'Text' },
        { property: 'allowDuplicates', value: true, resultProperty: 'allowDuplicate' },
        { property: 'enableReorder', value: false },
        { property: 'min', value: 1 },
        { property: 'max', value: 10 },
        { property: 'step', value: 2 },
      ])(
        `should return a valid widget edit with $property=$value`,
        ({ property, value, resultProperty }) => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'NumberList',
            label: 'Label',
            watchChanges: false,
            widget: 'NumberInputList',
            [property]: value,
          });

          expect(result).toMatchObject({
            parameters: {
              [resultProperty || property]: value,
            },
          });
        },
      );
    });

    describe('ColorPicker', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'ColorPicker',
        });

        expect(result).toEqual({
          name: 'color editor',
          parameters: {
            enableOpacity: false,
            placeholder: null,
            quickPalette: null,
          },
        });
      });
    });

    describe('CurrencyInput', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'Number',
          label: 'Label',
          watchChanges: false,
          widget: 'CurrencyInput',
          currency: 'EUR',
        });

        expect(result).toEqual({
          name: 'price editor',
          parameters: {
            placeholder: null,
            min: null,
            max: null,
            step: null,
            currency: 'EUR',
            base: 'Unit',
          },
        });
      });

      describe.each(['min', 'max', 'step'])('%s', parameter => {
        it('should copy a valid value in parameters', () => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'Number',
            label: 'Label',
            watchChanges: false,
            widget: 'CurrencyInput',
            currency: 'EUR',
            [parameter]: 10,
          });

          expect(result).toMatchObject({
            name: 'price editor',
            parameters: {
              [parameter]: 10,
            },
          });
        });

        it('should ignore an invalid value and replace it by null', () => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'Number',
            label: 'Label',
            watchChanges: false,
            widget: 'CurrencyInput',
            currency: 'EUR',
            [parameter]: 'foo',
          });

          expect(result).toMatchObject({
            name: 'price editor',
            parameters: {
              [parameter]: null,
            },
          });
        });
      });

      it('should copy the placeholder', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'Number',
          label: 'Label',
          watchChanges: false,
          widget: 'CurrencyInput',
          currency: 'EUR',
          placeholder: 'Placeholder',
        });

        expect(result).toMatchObject({
          name: 'price editor',
          parameters: {
            placeholder: 'Placeholder',
          },
        });
      });

      describe('base', () => {
        it.each(['unit', 'units', 'Unit', 'Units'])(
          `should return 'Unit' when base is %s`,
          base => {
            const result = GeneratorActionFieldWidget.buildWidgetOptions({
              type: 'Number',
              label: 'Label',
              watchChanges: false,
              widget: 'CurrencyInput',
              currency: 'EUR',
              // @ts-expect-error -- testing invalid values but we want to support them
              base,
            });

            expect(result).toMatchObject({
              name: 'price editor',
              parameters: {
                base: 'Unit',
              },
            });
          },
        );

        it.each(['cent', 'cents', 'Cent', 'Cents'])(
          `should return 'Cents' when base is %s`,
          base => {
            const result = GeneratorActionFieldWidget.buildWidgetOptions({
              type: 'Number',
              label: 'Label',
              watchChanges: false,
              widget: 'CurrencyInput',
              currency: 'EUR',
              // @ts-expect-error -- testing invalid values but we want to support them
              base,
            });

            expect(result).toMatchObject({
              name: 'price editor',
              parameters: {
                base: 'Cents',
              },
            });
          },
        );

        it('should replace invalid values by Unit', () => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'Number',
            label: 'Label',
            watchChanges: false,
            widget: 'CurrencyInput',
            currency: 'EUR',
            // @ts-expect-error -- testing invalid values
            base: 'foo',
          });

          expect(result).toMatchObject({
            name: 'price editor',
            parameters: {
              base: 'Unit',
            },
          });
        });
      });

      describe('currency', () => {
        it('should copy a valid value in parameters', () => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'Number',
            label: 'Label',
            watchChanges: false,
            widget: 'CurrencyInput',
            currency: 'EUR',
          });

          expect(result).toMatchObject({
            name: 'price editor',
            parameters: {
              currency: 'EUR',
            },
          });
        });

        it('should uppercase the currency', () => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'Number',
            label: 'Label',
            watchChanges: false,
            widget: 'CurrencyInput',
            currency: 'eur',
          });

          expect(result).toMatchObject({
            name: 'price editor',
            parameters: {
              currency: 'EUR',
            },
          });
        });

        it.each([123, 'EURO', null, ''])(
          'should set currency to null when equal to %s',
          currency => {
            const result = GeneratorActionFieldWidget.buildWidgetOptions({
              type: 'Number',
              label: 'Label',
              watchChanges: false,
              widget: 'CurrencyInput',
              currency: currency as string,
            });

            expect(result).toMatchObject({
              name: 'price editor',
              parameters: {
                currency: null,
              },
            });
          },
        );
      });
    });

    describe('DatePicker', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'Date',
          label: 'Label',
          watchChanges: false,
          widget: 'DatePicker',
        });

        expect(result).toEqual({
          name: 'date editor',
          parameters: {
            placeholder: null,
            format: null,
            minDate: null,
            maxDate: null,
          },
        });
      });

      describe.each(['placeholder', 'format'])('%s', parameter => {
        it('should copy a valid value in parameters', () => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'Date',
            label: 'Label',
            watchChanges: false,
            widget: 'DatePicker',
            [parameter]: 'ABC',
          });

          expect(result).toMatchObject({
            name: 'date editor',
            parameters: {
              [parameter]: 'ABC',
            },
          });
        });
      });

      describe.each(['min', 'max'])('%s', parameter => {
        it('should copy a valid value in parameters', () => {
          const date = new Date('2000-02-01T00:01:01.001Z');
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'Date',
            label: 'Label',
            watchChanges: false,
            widget: 'DatePicker',
            [parameter]: date,
          });

          expect(result).toMatchObject({
            name: 'date editor',
            parameters: {
              [`${parameter}Date`]: '2000-02-01T00:01:01.001Z',
            },
          });
        });

        it('should ignore an invalid value and replace it by null', () => {
          const result = GeneratorActionFieldWidget.buildWidgetOptions({
            type: 'Date',
            label: 'Label',
            watchChanges: false,
            widget: 'DatePicker',
            [parameter]: 'foo',
          });

          expect(result).toMatchObject({
            name: 'date editor',
            parameters: {
              [`${parameter}Date`]: null,
            },
          });
        });
      });
    });

    describe('TimePicker', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'Time',
          label: 'Label',
          watchChanges: false,
          widget: 'TimePicker',
        });

        expect(result).toEqual({
          name: 'time editor',
          parameters: {},
        });
      });
    });

    describe('JsonEditor', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'Json',
          label: 'Label',
          watchChanges: false,
          widget: 'JsonEditor',
        });

        expect(result).toEqual({
          name: 'json code editor',
          parameters: {},
        });
      });
    });

    describe('UserDropdown', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'UserDropdown',
        });

        expect(result).toEqual({
          name: 'assignee editor',
          parameters: {
            placeholder: null,
          },
        });
      });

      it('should return a valid widget edit with placeholder mapped in parameters', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          placeholder: 'abc',
          widget: 'UserDropdown',
        });

        expect(result).toEqual({
          name: 'assignee editor',
          parameters: {
            placeholder: 'abc',
          },
        });
      });
    });

    describe('AddressAutocomplete', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          widget: 'AddressAutocomplete',
        });

        expect(result).toEqual({
          name: 'address editor',
          parameters: {
            placeholder: null,
          },
        });
      });

      it('should return a valid widget edit with placeholder mapped in parameters', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'String',
          label: 'Label',
          watchChanges: false,
          placeholder: 'abc',
          widget: 'AddressAutocomplete',
        });

        expect(result).toEqual({
          name: 'address editor',
          parameters: {
            placeholder: 'abc',
          },
        });
      });
    });

    describe('FilePicker', () => {
      it('should return a valid widget edit with default values', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'File',
          label: 'Label',
          watchChanges: false,
          widget: 'FilePicker',
        });

        expect(result).toEqual({
          name: 'file picker',
          parameters: {
            prefix: null,
            filesExtensions: null,
            filesSizeLimit: null,
            filesCountLimit: null,
          },
        });
      });

      it('should return a valid widget edit with placeholder mapped in parameters', () => {
        const result = GeneratorActionFieldWidget.buildWidgetOptions({
          type: 'File',
          label: 'Label',
          watchChanges: false,
          widget: 'FilePicker',
          extensions: ['png', 'jpg'],
          maxCount: 10,
          maxSizeMb: 12,
        });

        expect(result).toEqual({
          name: 'file picker',
          parameters: {
            prefix: null,
            filesExtensions: ['png', 'jpg'],
            filesSizeLimit: 12,
            filesCountLimit: 10,
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

    it('should return a valid widget with all the properties', () => {
      const result = GeneratorActionFieldWidget.buildWidgetOptions({
        type: 'String',
        label: 'Label',
        watchChanges: false,
        widget: 'ColorPicker',
        enableOpacity: true,
        quickPalette: ['red', 'green', 'blue'],
        placeholder: 'Placeholder',
      });

      expect(result).toEqual({
        name: 'color editor',
        parameters: {
          placeholder: 'Placeholder',
          enableOpacity: true,
          quickPalette: ['red', 'green', 'blue'],
        },
      });
    });
  });
});
