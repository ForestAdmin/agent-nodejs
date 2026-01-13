import type FieldFormStates from '../../src/action-fields/field-form-states';
import type HttpRequester from '../../src/http-requester';

import Action from '../../src/domains/action';

jest.mock('../../src/http-requester');
jest.mock('../../src/action-fields/field-form-states');

describe('Action', () => {
  let httpRequester: jest.Mocked<HttpRequester>;
  let fieldsFormStates: jest.Mocked<FieldFormStates>;
  let action: Action;

  beforeEach(() => {
    jest.clearAllMocks();

    httpRequester = {
      query: jest.fn(),
    } as any;

    fieldsFormStates = {
      getFieldValues: jest.fn().mockReturnValue({ email: 'test@example.com' }),
      setFieldValue: jest.fn().mockResolvedValue(undefined),
      getFields: jest.fn().mockReturnValue([]),
      getField: jest.fn().mockReturnValue({
        getName: () => 'email',
        getType: () => 'String',
      }),
      getLayout: jest.fn().mockReturnValue([]),
    } as any;

    action = new Action('users', httpRequester, '/forest/actions/send-email', fieldsFormStates, [
      '1',
      '2',
    ]);
  });

  describe('execute', () => {
    it('should call httpRequester.query with correct parameters', async () => {
      httpRequester.query.mockResolvedValue({ success: 'Action executed' });

      const result = await action.execute();

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/actions/send-email',
        body: {
          data: {
            attributes: {
              collection_name: 'users',
              ids: ['1', '2'],
              values: { email: 'test@example.com' },
              signed_approval_request: undefined,
            },
            type: 'custom-action-requests',
          },
        },
      });
      expect(result).toEqual({ success: 'Action executed' });
    });

    it('should include signed approval request when provided', async () => {
      httpRequester.query.mockResolvedValue({ success: 'Action executed' });
      const signedApprovalRequest = { token: 'approval-token', requesterId: '123' };

      await action.execute(signedApprovalRequest);

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/actions/send-email',
        body: {
          data: {
            attributes: expect.objectContaining({
              signed_approval_request: signedApprovalRequest,
            }),
            type: 'custom-action-requests',
          },
        },
      });
    });
  });

  describe('setFields', () => {
    it('should call setFieldValue for each field', async () => {
      await action.setFields({
        email: 'new@example.com',
        subject: 'Hello',
      });

      expect(fieldsFormStates.setFieldValue).toHaveBeenCalledTimes(2);
      expect(fieldsFormStates.setFieldValue).toHaveBeenCalledWith('email', 'new@example.com');
      expect(fieldsFormStates.setFieldValue).toHaveBeenCalledWith('subject', 'Hello');
    });

    it('should process fields sequentially', async () => {
      const callOrder: string[] = [];
      fieldsFormStates.setFieldValue = jest.fn().mockImplementation(async (field: string) => {
        callOrder.push(field);
      });

      await action.setFields({
        first: 'value1',
        second: 'value2',
        third: 'value3',
      });

      expect(callOrder).toEqual(['first', 'second', 'third']);
    });

    it('should throw when field does not exist', async () => {
      fieldsFormStates.getField.mockReturnValue(null);

      await expect(
        action.setFields({
          nonexistent: 'value',
        }),
      ).rejects.toThrow('Field "nonexistent" does not exist in this form');
    });
  });

  describe('tryToSetFields', () => {
    it('should call setFieldValue for each field that exists', async () => {
      await action.tryToSetFields({
        email: 'new@example.com',
        subject: 'Hello',
      });

      expect(fieldsFormStates.setFieldValue).toHaveBeenCalledTimes(2);
      expect(fieldsFormStates.setFieldValue).toHaveBeenCalledWith('email', 'new@example.com');
      expect(fieldsFormStates.setFieldValue).toHaveBeenCalledWith('subject', 'Hello');
    });

    it('should return skipped fields when field does not exist', async () => {
      fieldsFormStates.getField.mockImplementation((fieldName: string) => {
        if (fieldName === 'nonexistent') return null;

        return { getName: () => fieldName, getType: () => 'String' } as any;
      });

      const skipped = await action.tryToSetFields({
        email: 'new@example.com',
        nonexistent: 'value',
      });

      expect(skipped).toEqual(['nonexistent']);
      expect(fieldsFormStates.setFieldValue).toHaveBeenCalledTimes(1);
      expect(fieldsFormStates.setFieldValue).toHaveBeenCalledWith('email', 'new@example.com');
    });

    it('should return empty array when all fields exist', async () => {
      const skipped = await action.tryToSetFields({
        email: 'new@example.com',
      });

      expect(skipped).toEqual([]);
    });
  });

  describe('getFields', () => {
    it('should return action fields', () => {
      fieldsFormStates.getFields.mockReturnValue([
        { getName: () => 'email', getType: () => 'String' } as any,
        { getName: () => 'count', getType: () => 'Number' } as any,
      ]);

      const fields = action.getFields();

      expect(fields).toHaveLength(2);
    });
  });

  describe('getField', () => {
    it('should return string field for String type', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'email',
        getType: () => 'String',
      } as any);

      const field = action.getField('email');
      expect(field).toBeDefined();
    });

    it('should return number field for Number type', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'count',
        getType: () => 'Number',
      } as any);

      const field = action.getField('count');
      expect(field).toBeDefined();
    });

    it('should return json field for Json type', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'data',
        getType: () => 'Json',
      } as any);

      const field = action.getField('data');
      expect(field).toBeDefined();
    });

    it('should return checkbox field for Boolean type', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'active',
        getType: () => 'Boolean',
      } as any);

      const field = action.getField('active');
      expect(field).toBeDefined();
    });

    it('should return date field for Date type', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'birthDate',
        getType: () => 'Date',
      } as any);

      const field = action.getField('birthDate');
      expect(field).toBeDefined();
    });

    it('should return enum field for Enum type', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'status',
        getType: () => 'Enum',
      } as any);

      const field = action.getField('status');
      expect(field).toBeDefined();
    });

    it('should return number list field for NumberList type', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'ids',
        getType: () => 'NumberList',
      } as any);

      const field = action.getField('ids');
      expect(field).toBeDefined();
    });

    it('should return number list field for ["Number"] type', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'ids',
        getType: () => ['Number'],
      } as any);

      const field = action.getField('ids');
      expect(field).toBeDefined();
    });

    it('should return string list field for StringList type', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'tags',
        getType: () => 'StringList',
      } as any);

      const field = action.getField('tags');
      expect(field).toBeDefined();
    });

    it('should return string list field for ["String"] type', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'tags',
        getType: () => ['String'],
      } as any);

      const field = action.getField('tags');
      expect(field).toBeDefined();
    });

    it('should return string field as default', () => {
      fieldsFormStates.getField.mockReturnValue({
        getName: () => 'unknown',
        getType: () => 'UnknownType',
      } as any);

      const field = action.getField('unknown');
      expect(field).toBeDefined();
    });
  });

  describe('specific field getters', () => {
    it('should return ActionFieldNumber', () => {
      const field = action.getFieldNumber('count');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldJson', () => {
      const field = action.getFieldJson('data');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldNumberList', () => {
      const field = action.getFieldNumberList('ids');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldString', () => {
      const field = action.getFieldString('name');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldStringList', () => {
      const field = action.getFieldStringList('tags');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldDropdown', () => {
      const field = action.getDropdownField('status');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldCheckbox', () => {
      const field = action.getCheckboxField('active');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldCheckboxGroup', () => {
      const field = action.getCheckboxGroupField('options');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldColorPicker', () => {
      const field = action.getColorPickerField('color');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldDate', () => {
      const field = action.getDateField('birthDate');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldEnum', () => {
      const field = action.getEnumField('status');
      expect(field).toBeDefined();
    });

    it('should return ActionFieldRadioGroup', () => {
      const field = action.getRadioGroupField('choice');
      expect(field).toBeDefined();
    });
  });

  describe('getLayout', () => {
    it('should return action layout root', () => {
      fieldsFormStates.getLayout.mockReturnValue([]);

      const layout = action.getLayout();
      expect(layout).toBeDefined();
    });
  });

  describe('doesFieldExist', () => {
    it('should return true when field exists', () => {
      fieldsFormStates.getField.mockReturnValue({ getName: () => 'email' } as any);

      expect(action.doesFieldExist('email')).toBe(true);
    });

    it('should return false when field does not exist', () => {
      fieldsFormStates.getField.mockReturnValue(null);

      expect(action.doesFieldExist('nonexistent')).toBe(false);
    });
  });
});
