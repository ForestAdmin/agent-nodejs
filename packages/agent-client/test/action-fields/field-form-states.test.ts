import FieldFormStates from '../../src/action-fields/field-form-states';
import HttpRequester from '../../src/http-requester';

jest.mock('../../src/http-requester');

describe('FieldFormStates', () => {
  let httpRequester: jest.Mocked<HttpRequester>;
  let fieldFormStates: FieldFormStates;

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequester = {
      query: jest.fn(),
    } as any;
    fieldFormStates = new FieldFormStates(
      'testAction',
      '/forest/actions/test-action',
      'users',
      httpRequester,
      ['1', '2'],
    );
  });

  describe('loadInitialState', () => {
    it('should call httpRequester.query with correct parameters for load hook', async () => {
      const mockResponse = {
        fields: [
          { field: 'name', type: 'String', isRequired: true, isReadOnly: false, value: '' },
          { field: 'age', type: 'Number', isRequired: false, isReadOnly: false, value: 0 },
        ],
        layout: [{ component: 'input', fieldId: 'name' }],
      };
      httpRequester.query.mockResolvedValue(mockResponse);

      await fieldFormStates.loadInitialState();

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/actions/test-action/hooks/load',
        body: {
          data: {
            attributes: {
              collection_name: 'users',
              ids: ['1', '2'],
              values: {},
            },
            type: 'action-requests',
          },
        },
      });
    });

    it('should populate fields from the response', async () => {
      const mockResponse = {
        fields: [
          {
            field: 'email',
            type: 'String',
            isRequired: true,
            isReadOnly: false,
            value: 'test@test.com',
          },
        ],
        layout: [],
      };
      httpRequester.query.mockResolvedValue(mockResponse);

      await fieldFormStates.loadInitialState();

      const fields = fieldFormStates.getFields();
      expect(fields).toHaveLength(1);
      expect(fields[0].getName()).toBe('email');
      expect(fields[0].getValue()).toBe('test@test.com');
    });

    it('should populate layout from the response', async () => {
      const mockLayout = [{ component: 'input', fieldId: 'name' }, { component: 'separator' }];
      httpRequester.query.mockResolvedValue({ fields: [], layout: mockLayout });

      await fieldFormStates.loadInitialState();

      expect(fieldFormStates.getLayout()).toEqual(mockLayout);
    });

    it('should clear previous fields and layout on reload', async () => {
      // First load
      httpRequester.query.mockResolvedValue({
        fields: [{ field: 'field1', type: 'String', isRequired: false, isReadOnly: false }],
        layout: [{ component: 'input', fieldId: 'field1' }],
      });
      await fieldFormStates.loadInitialState();
      expect(fieldFormStates.getFields()).toHaveLength(1);

      // Second load
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'field2', type: 'Number', isRequired: false, isReadOnly: false },
          { field: 'field3', type: 'Boolean', isRequired: false, isReadOnly: false },
        ],
        layout: [{ component: 'row', fields: [] }],
      });
      await fieldFormStates.loadInitialState();

      expect(fieldFormStates.getFields()).toHaveLength(2);
      expect(fieldFormStates.getFields()[0].getName()).toBe('field2');
      expect(fieldFormStates.getLayout()).toHaveLength(1);
    });
  });

  describe('getField', () => {
    beforeEach(async () => {
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'firstName', type: 'String', isRequired: true, isReadOnly: false },
          { field: 'lastName', type: 'String', isRequired: false, isReadOnly: false },
        ],
        layout: [],
      });
      await fieldFormStates.loadInitialState();
    });

    it('should return the field matching the name', () => {
      const field = fieldFormStates.getField('firstName');
      expect(field?.getName()).toBe('firstName');
    });

    it('should return undefined when field is not found', () => {
      const field = fieldFormStates.getField('nonExistent');
      expect(field).toBeUndefined();
    });
  });

  describe('getFieldValues', () => {
    it('should return an object with all field values', async () => {
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'name', type: 'String', isRequired: false, isReadOnly: false, value: 'John' },
          { field: 'age', type: 'Number', isRequired: false, isReadOnly: false, value: 30 },
          {
            field: 'empty',
            type: 'String',
            isRequired: false,
            isReadOnly: false,
            value: undefined,
          },
        ],
        layout: [],
      });
      await fieldFormStates.loadInitialState();

      const values = fieldFormStates.getFieldValues();

      expect(values).toEqual({ name: 'John', age: 30 });
      expect(values).not.toHaveProperty('empty');
    });

    it('should return empty object when no fields have values', async () => {
      httpRequester.query.mockResolvedValue({
        fields: [
          {
            field: 'field1',
            type: 'String',
            isRequired: false,
            isReadOnly: false,
            value: undefined,
          },
        ],
        layout: [],
      });
      await fieldFormStates.loadInitialState();

      expect(fieldFormStates.getFieldValues()).toEqual({});
    });
  });

  describe('getMultipleChoiceField', () => {
    it('should return ActionFieldMultipleChoice for the specified field', async () => {
      httpRequester.query.mockResolvedValue({
        fields: [
          {
            field: 'status',
            type: 'Enum',
            isRequired: false,
            isReadOnly: false,
            widgetEdit: {
              parameters: {
                static: {
                  options: [
                    { label: 'Active', value: 'active' },
                    { label: 'Inactive', value: 'inactive' },
                  ],
                },
              },
            },
          },
        ],
        layout: [],
      });
      await fieldFormStates.loadInitialState();

      const multipleChoice = fieldFormStates.getMultipleChoiceField('status');
      expect(multipleChoice.getOptions()).toHaveLength(2);
    });
  });

  describe('setFieldValue', () => {
    beforeEach(async () => {
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'name', type: 'String', isRequired: false, isReadOnly: false, value: 'initial' },
        ],
        layout: [],
      });
      await fieldFormStates.loadInitialState();
    });

    it('should update the field value and call change hook', async () => {
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'name', type: 'String', isRequired: false, isReadOnly: false, value: 'updated' },
        ],
        layout: [],
      });

      await fieldFormStates.setFieldValue('name', 'updated');

      expect(httpRequester.query).toHaveBeenLastCalledWith({
        method: 'post',
        path: '/forest/actions/test-action/hooks/change',
        body: {
          data: {
            attributes: {
              collection_name: 'users',
              changed_field: 'name',
              ids: ['1', '2'],
              fields: expect.any(Array),
            },
            type: 'custom-action-hook-requests',
          },
        },
      });
    });

    it('should throw error when field is not found', async () => {
      await expect(fieldFormStates.setFieldValue('nonExistent', 'value')).rejects.toThrow(
        'Field "nonExistent" not found in action "testAction"',
      );
    });

    it('should update layout after change hook response', async () => {
      const newLayout = [{ component: 'separator' }, { component: 'input', fieldId: 'name' }];
      httpRequester.query.mockResolvedValue({
        fields: [
          { field: 'name', type: 'String', isRequired: false, isReadOnly: false, value: 'new' },
        ],
        layout: newLayout,
      });

      await fieldFormStates.setFieldValue('name', 'new');

      expect(fieldFormStates.getLayout()).toEqual(newLayout);
    });
  });
});
