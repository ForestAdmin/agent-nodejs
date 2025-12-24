import ActionFieldCheckbox from '../../src/action-fields/action-field-checkbox';
import ActionFieldCheckboxGroup from '../../src/action-fields/action-field-checkbox-group';
import ActionFieldColorPicker from '../../src/action-fields/action-field-color-picker';
import ActionFieldDate from '../../src/action-fields/action-field-date';
import ActionFieldDropdown from '../../src/action-fields/action-field-dropdown';
import ActionFieldEnum from '../../src/action-fields/action-field-enum';
import ActionFieldJson from '../../src/action-fields/action-field-json';
import ActionFieldNumber from '../../src/action-fields/action-field-number';
import ActionFieldNumberList from '../../src/action-fields/action-field-number-list';
import ActionFieldRadioGroup from '../../src/action-fields/action-field-radio-group';
import ActionFieldString from '../../src/action-fields/action-field-string';
import ActionFieldStringList from '../../src/action-fields/action-field-string-list';
import FieldFormStates from '../../src/action-fields/field-form-states';
import HttpRequester from '../../src/http-requester';

jest.mock('../../src/http-requester');

describe('ActionField implementations', () => {
  let httpRequester: jest.Mocked<HttpRequester>;
  let fieldFormStates: FieldFormStates;

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequester = { query: jest.fn() } as any;
    fieldFormStates = new FieldFormStates(
      'testAction',
      '/forest/actions/test',
      'users',
      httpRequester,
      ['1'],
    );
  });

  const setupFields = async (fields: any[]) => {
    httpRequester.query.mockResolvedValue({ fields, layout: [] });
    await fieldFormStates.loadInitialState();
  };

  describe('ActionFieldCheckbox', () => {
    it('should check the checkbox by setting value to true', async () => {
      await setupFields([
        { field: 'accepted', type: 'Boolean', isRequired: false, isReadOnly: false, value: false },
      ]);
      const field = new ActionFieldCheckbox('accepted', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'accepted', type: 'Boolean', isRequired: false, isReadOnly: false, value: true },
        ],
        layout: [],
      });

      await field.check();

      expect(fieldFormStates.getField('accepted')?.getValue()).toBe(true);
    });

    it('should uncheck the checkbox by setting value to false', async () => {
      await setupFields([
        { field: 'accepted', type: 'Boolean', isRequired: false, isReadOnly: false, value: true },
      ]);
      const field = new ActionFieldCheckbox('accepted', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'accepted', type: 'Boolean', isRequired: false, isReadOnly: false, value: false },
        ],
        layout: [],
      });

      await field.uncheck();

      expect(fieldFormStates.getField('accepted')?.getValue()).toBe(false);
    });
  });

  describe('ActionFieldCheckboxGroup', () => {
    const options = [
      { label: 'Option A', value: 'a' },
      { label: 'Option B', value: 'b' },
      { label: 'Option C', value: 'c' },
    ];

    beforeEach(async () => {
      await setupFields([
        {
          field: 'tags',
          type: 'StringList',
          isRequired: false,
          isReadOnly: false,
          value: ['a'],
          widgetEdit: { parameters: { static: { options } } },
        },
      ]);
    });

    it('should return options', async () => {
      const field = new ActionFieldCheckboxGroup('tags', fieldFormStates);
      expect(field.getOptions()).toEqual(options);
    });

    it('should check an option by adding it to the value array', async () => {
      const field = new ActionFieldCheckboxGroup('tags', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          {
            field: 'tags',
            type: 'StringList',
            isRequired: false,
            isReadOnly: false,
            value: ['a', 'b'],
            widgetEdit: { parameters: { static: { options } } },
          },
        ],
        layout: [],
      });

      await field.check('Option B');

      const newValue = fieldFormStates.getField('tags')?.getValue() as string[];
      expect(newValue).toContain('b');
    });

    it('should uncheck an option by removing it from the value array', async () => {
      await setupFields([
        {
          field: 'tags',
          type: 'StringList',
          isRequired: false,
          isReadOnly: false,
          value: ['a', 'b'],
          widgetEdit: { parameters: { static: { options } } },
        },
      ]);
      const field = new ActionFieldCheckboxGroup('tags', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          {
            field: 'tags',
            type: 'StringList',
            isRequired: false,
            isReadOnly: false,
            value: ['b'],
            widgetEdit: { parameters: { static: { options } } },
          },
        ],
        layout: [],
      });

      await field.uncheck('Option A');

      const newValue = fieldFormStates.getField('tags')?.getValue() as string[];
      expect(newValue).not.toContain('a');
    });

    it('should handle checking when value is initially empty', async () => {
      await setupFields([
        {
          field: 'tags',
          type: 'StringList',
          isRequired: false,
          isReadOnly: false,
          value: null,
          widgetEdit: { parameters: { static: { options } } },
        },
      ]);
      const field = new ActionFieldCheckboxGroup('tags', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          {
            field: 'tags',
            type: 'StringList',
            isRequired: false,
            isReadOnly: false,
            value: ['a'],
            widgetEdit: { parameters: { static: { options } } },
          },
        ],
        layout: [],
      });

      await field.check('Option A');

      expect(httpRequester.query).toHaveBeenCalled();
    });
  });

  describe('ActionFieldColorPicker', () => {
    beforeEach(async () => {
      await setupFields([
        {
          field: 'color',
          type: 'String',
          isRequired: false,
          isReadOnly: false,
          value: '#000000',
          widgetEdit: {
            parameters: {
              static: {
                enableOpacity: true,
                quickPalette: ['#ff0000', '#00ff00', '#0000ff'],
              },
            },
          },
        },
      ]);
    });

    it('should fill with a string value', async () => {
      const field = new ActionFieldColorPicker('color', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'color', type: 'String', isRequired: false, isReadOnly: false, value: '#ffffff' },
        ],
        layout: [],
      });

      await field.fill('#ffffff');

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should fill with a number value and convert to string', async () => {
      const field = new ActionFieldColorPicker('color', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'color', type: 'String', isRequired: false, isReadOnly: false, value: '16777215' },
        ],
        layout: [],
      });

      await field.fill(16777215);

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should fill with undefined', async () => {
      const field = new ActionFieldColorPicker('color', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'color', type: 'String', isRequired: false, isReadOnly: false, value: undefined },
        ],
        layout: [],
      });

      await field.fill(undefined);

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should check if opacity is enabled', async () => {
      const field = new ActionFieldColorPicker('color', fieldFormStates);
      const result = await field.isOpacityEnable();
      expect(result).toBe(true);
    });

    it('should return quick palette', async () => {
      const field = new ActionFieldColorPicker('color', fieldFormStates);
      const palette = await field.getQuickPalette();
      expect(palette).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    });
  });

  describe('ActionFieldDate', () => {
    beforeEach(async () => {
      await setupFields([
        { field: 'birthDate', type: 'Date', isRequired: false, isReadOnly: false, value: null },
      ]);
    });

    it('should fill with a Date object', async () => {
      const field = new ActionFieldDate('birthDate', fieldFormStates);
      const date = new Date('2023-06-15T10:30:00Z');
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'birthDate', type: 'Date', isRequired: false, isReadOnly: false, value: date.toISOString() },
        ],
        layout: [],
      });

      await field.fill(date);

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should fill with a timestamp number', async () => {
      const field = new ActionFieldDate('birthDate', fieldFormStates);
      const timestamp = 1686824400000; // 2023-06-15
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'birthDate', type: 'Date', isRequired: false, isReadOnly: false, value: new Date(timestamp).toISOString() },
        ],
        layout: [],
      });

      await field.fill(timestamp);

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should fill with undefined', async () => {
      const field = new ActionFieldDate('birthDate', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'birthDate', type: 'Date', isRequired: false, isReadOnly: false, value: undefined },
        ],
        layout: [],
      });

      await field.fill(undefined);

      expect(httpRequester.query).toHaveBeenCalled();
    });
  });

  describe('ActionFieldDropdown', () => {
    const options = [
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
    ];

    beforeEach(async () => {
      await setupFields([
        {
          field: 'priority',
          type: 'Enum',
          isRequired: false,
          isReadOnly: false,
          value: 'low',
          widgetEdit: { parameters: { static: { options } } },
        },
      ]);
    });

    it('should return options', () => {
      const field = new ActionFieldDropdown('priority', fieldFormStates);
      expect(field.getOptions()).toEqual(options);
    });

    it('should select an option by label', async () => {
      const field = new ActionFieldDropdown('priority', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          {
            field: 'priority',
            type: 'Enum',
            isRequired: false,
            isReadOnly: false,
            value: 'high',
            widgetEdit: { parameters: { static: { options } } },
          },
        ],
        layout: [],
      });

      await field.select('High');

      expect(httpRequester.query).toHaveBeenCalled();
    });
  });

  describe('ActionFieldEnum', () => {
    beforeEach(async () => {
      await setupFields([
        {
          field: 'status',
          type: 'Enum',
          isRequired: false,
          isReadOnly: false,
          value: 'pending',
          enums: ['pending', 'approved', 'rejected'],
        },
      ]);
    });

    it('should return enum options', () => {
      const field = new ActionFieldEnum('status', fieldFormStates);
      expect(field.getOptions()).toEqual(['pending', 'approved', 'rejected']);
    });

    it('should select a valid option', async () => {
      const field = new ActionFieldEnum('status', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          {
            field: 'status',
            type: 'Enum',
            isRequired: false,
            isReadOnly: false,
            value: 'approved',
            enums: ['pending', 'approved', 'rejected'],
          },
        ],
        layout: [],
      });

      await field.select('approved');

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should throw error when selecting invalid option', async () => {
      const field = new ActionFieldEnum('status', fieldFormStates);

      await expect(field.select('invalid')).rejects.toThrow(
        'Option "invalid" not found in field "status"',
      );
    });
  });

  describe('ActionFieldJson', () => {
    beforeEach(async () => {
      await setupFields([
        { field: 'config', type: 'Json', isRequired: false, isReadOnly: false, value: null },
      ]);
    });

    it('should fill with an object', async () => {
      const field = new ActionFieldJson('config', fieldFormStates);
      const jsonValue = { key: 'value', nested: { a: 1 } };
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'config', type: 'Json', isRequired: false, isReadOnly: false, value: jsonValue },
        ],
        layout: [],
      });

      await field.fill(jsonValue);

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should fill with undefined', async () => {
      const field = new ActionFieldJson('config', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'config', type: 'Json', isRequired: false, isReadOnly: false, value: undefined },
        ],
        layout: [],
      });

      await field.fill(undefined);

      expect(httpRequester.query).toHaveBeenCalled();
    });
  });

  describe('ActionFieldNumber', () => {
    beforeEach(async () => {
      await setupFields([
        { field: 'quantity', type: 'Number', isRequired: false, isReadOnly: false, value: 0 },
      ]);
    });

    it('should fill with a number', async () => {
      const field = new ActionFieldNumber('quantity', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'quantity', type: 'Number', isRequired: false, isReadOnly: false, value: 42 },
        ],
        layout: [],
      });

      await field.fill(42);

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should fill with a string number and convert to number', async () => {
      const field = new ActionFieldNumber('quantity', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'quantity', type: 'Number', isRequired: false, isReadOnly: false, value: 123 },
        ],
        layout: [],
      });

      await field.fill('123');

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should fill with undefined', async () => {
      const field = new ActionFieldNumber('quantity', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'quantity', type: 'Number', isRequired: false, isReadOnly: false, value: undefined },
        ],
        layout: [],
      });

      await field.fill(undefined);

      expect(httpRequester.query).toHaveBeenCalled();
    });
  });

  describe('ActionFieldNumberList', () => {
    beforeEach(async () => {
      await setupFields([
        { field: 'scores', type: 'NumberList', isRequired: false, isReadOnly: false, value: [10, 20] },
      ]);
    });

    it('should add a number to the list', async () => {
      const field = new ActionFieldNumberList('scores', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'scores', type: 'NumberList', isRequired: false, isReadOnly: false, value: [10, 20, 30] },
        ],
        layout: [],
      });

      await field.add(30);

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should add to empty list', async () => {
      await setupFields([
        { field: 'scores', type: 'NumberList', isRequired: false, isReadOnly: false, value: null },
      ]);
      const field = new ActionFieldNumberList('scores', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'scores', type: 'NumberList', isRequired: false, isReadOnly: false, value: [5] },
        ],
        layout: [],
      });

      await field.add(5);

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should remove a number from the list', async () => {
      await setupFields([
        { field: 'scores', type: 'NumberList', isRequired: false, isReadOnly: false, value: [10, 20, 30] },
      ]);
      const field = new ActionFieldNumberList('scores', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'scores', type: 'NumberList', isRequired: false, isReadOnly: false, value: [10, 30] },
        ],
        layout: [],
      });

      await field.remove(20);

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should throw error when removing value not in list', async () => {
      const field = new ActionFieldNumberList('scores', fieldFormStates);

      await expect(field.remove(999)).rejects.toThrow('Value 999 is not in the list');
    });
  });

  describe('ActionFieldString', () => {
    beforeEach(async () => {
      await setupFields([
        { field: 'name', type: 'String', isRequired: false, isReadOnly: false, value: '' },
      ]);
    });

    it('should fill with a string', async () => {
      const field = new ActionFieldString('name', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'name', type: 'String', isRequired: false, isReadOnly: false, value: 'John' },
        ],
        layout: [],
      });

      await field.fill('John');

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should fill with a number and convert to string', async () => {
      const field = new ActionFieldString('name', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'name', type: 'String', isRequired: false, isReadOnly: false, value: '42' },
        ],
        layout: [],
      });

      await field.fill(42);

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should fill with undefined', async () => {
      const field = new ActionFieldString('name', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'name', type: 'String', isRequired: false, isReadOnly: false, value: undefined },
        ],
        layout: [],
      });

      await field.fill(undefined);

      expect(httpRequester.query).toHaveBeenCalled();
    });
  });

  describe('ActionFieldStringList', () => {
    beforeEach(async () => {
      await setupFields([
        { field: 'tags', type: 'StringList', isRequired: false, isReadOnly: false, value: ['a', 'b'] },
      ]);
    });

    it('should add a string to the list', async () => {
      const field = new ActionFieldStringList('tags', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'tags', type: 'StringList', isRequired: false, isReadOnly: false, value: ['a', 'b', 'c'] },
        ],
        layout: [],
      });

      await field.add('c');

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should add to empty list', async () => {
      await setupFields([
        { field: 'tags', type: 'StringList', isRequired: false, isReadOnly: false, value: null },
      ]);
      const field = new ActionFieldStringList('tags', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'tags', type: 'StringList', isRequired: false, isReadOnly: false, value: ['first'] },
        ],
        layout: [],
      });

      await field.add('first');

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should remove a string from the list', async () => {
      const field = new ActionFieldStringList('tags', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'tags', type: 'StringList', isRequired: false, isReadOnly: false, value: ['b'] },
        ],
        layout: [],
      });

      await field.remove('a');

      expect(httpRequester.query).toHaveBeenCalled();
    });

    it('should throw error when removing value not in list', async () => {
      const field = new ActionFieldStringList('tags', fieldFormStates);

      await expect(field.remove('not-in-list')).rejects.toThrow(
        'Value not-in-list is not in the list',
      );
    });
  });

  describe('ActionFieldRadioGroup', () => {
    const options = [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ];

    beforeEach(async () => {
      await setupFields([
        {
          field: 'confirm',
          type: 'Enum',
          isRequired: false,
          isReadOnly: false,
          value: null,
          widgetEdit: { parameters: { static: { options } } },
        },
      ]);
    });

    it('should return options', async () => {
      const field = new ActionFieldRadioGroup('confirm', fieldFormStates);
      const result = await field.getOptions();
      expect(result).toEqual(options);
    });

    it('should check an option by label', async () => {
      const field = new ActionFieldRadioGroup('confirm', fieldFormStates);
      httpRequester.query.mockResolvedValue({
        fields: [
          {
            field: 'confirm',
            type: 'Enum',
            isRequired: false,
            isReadOnly: false,
            value: 'yes',
            widgetEdit: { parameters: { static: { options } } },
          },
        ],
        layout: [],
      });

      await field.check('Yes');

      expect(httpRequester.query).toHaveBeenCalled();
    });
  });

  describe('ActionField base class methods', () => {
    beforeEach(async () => {
      await setupFields([
        {
          field: 'testField',
          type: 'String',
          isRequired: true,
          isReadOnly: false,
          value: 'test value',
        },
      ]);
    });

    it('should return the field name', () => {
      const field = new ActionFieldString('testField', fieldFormStates);
      expect(field.getName()).toBe('testField');
    });

    it('should return the field type', () => {
      const field = new ActionFieldString('testField', fieldFormStates);
      expect(field.getType()).toBe('String');
    });

    it('should return the field value', () => {
      const field = new ActionFieldString('testField', fieldFormStates);
      expect(field.getValue()).toBe('test value');
    });

    it('should return whether field is required', () => {
      const field = new ActionFieldString('testField', fieldFormStates);
      expect(field.isRequired()).toBe(true);
    });
  });
});
