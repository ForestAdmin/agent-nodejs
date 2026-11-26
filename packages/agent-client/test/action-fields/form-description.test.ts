import type HttpRequester from '../../src/http-requester';

import describeActionForm from '../../src/action-fields/form-description';
import Collection from '../../src/domains/collection';

async function actionWithFields(fields: Record<string, unknown>[]) {
  const httpRequester = { query: jest.fn(), stream: jest.fn() } as unknown as HttpRequester;
  const collection = new Collection('users', httpRequester, {
    users: {
      act: {
        id: 'users-act',
        name: 'act',
        endpoint: '/forest/actions/act',
        hooks: { load: false, change: [] },
        fields,
      },
    },
  } as never);

  return collection.action('act');
}

const field = (overrides: Record<string, unknown>) => ({
  field: 'name',
  type: 'String',
  isRequired: false,
  isReadOnly: false,
  ...overrides,
});

describe('describeActionForm', () => {
  it('should describe a field with its raw and effective types, value and description', async () => {
    const action = await actionWithFields([
      field({
        field: 'proof',
        defaultValue: 'x',
        isRequired: true,
        description: 'A scan',
        widgetEdit: { name: 'file picker', parameters: {} },
      }),
    ]);

    expect(describeActionForm(action).fields).toEqual([
      {
        name: 'proof',
        type: 'String',
        effectiveType: 'File',
        value: 'x',
        isRequired: true,
        description: 'A scan',
        widget: 'file picker',
      },
    ]);
  });

  it.each([
    ['an Enum', 'Enum'],
    ['an Enum list', ['Enum']],
  ])('should give the options of %s', async (_, type) => {
    const action = await actionWithFields([field({ type, enums: ['low', 'high'] })]);

    expect(describeActionForm(action).fields[0].enumValues).toEqual(['low', 'high']);
  });

  it('should give null options to an Enum the agent sent none for', async () => {
    const action = await actionWithFields([field({ type: 'Enum' })]);

    expect(describeActionForm(action).fields[0].enumValues).toBeNull();
  });

  it('should give the choices of a choice widget, value and label', async () => {
    const action = await actionWithFields([
      field({
        widgetEdit: {
          name: 'dropdown',
          parameters: { static: { options: [{ label: 'Low', value: 'low' }, 'high'] } },
        },
      }),
    ]);

    expect(describeActionForm(action).fields[0].allowedValues).toEqual([
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'high' },
    ]);
  });

  it('should list the required fields left without a value', async () => {
    const action = await actionWithFields([
      field({ field: 'a', isRequired: true }),
      field({ field: 'b', isRequired: true, defaultValue: '' }),
      field({ field: 'c', isRequired: true, defaultValue: 0 }),
      field({ field: 'd' }),
    ]);

    const form = describeActionForm(action);

    expect(form.requiredFields).toEqual(['a']);
    expect(form.canExecute).toBe(false);
  });

  it('should read a value override instead of the field value', async () => {
    const action = await actionWithFields([field({ field: 'proof', isRequired: true })]);

    const form = describeActionForm(action, { proof: 'handle' });

    expect(form.fields[0].value).toBe('handle');
    expect(form.canExecute).toBe(true);
  });

  it('should not take an inherited member for an override', async () => {
    const action = await actionWithFields([field({ field: 'toString', isRequired: true })]);

    expect(describeActionForm(action).requiredFields).toEqual(['toString']);
  });
});
