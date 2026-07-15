import type { ActionForm, ActionFormField } from '../../src/action/agent-action-client';

import { mapActionForm } from '../../src/action/action-form-mapper';

interface FakeField {
  name: string;
  type: string;
  value: unknown;
  isRequired: boolean;
  enumValues?: string[];
}

function fieldStub(f: FakeField): ActionFormField {
  return {
    getName: () => f.name,
    getType: () => f.type,
    getValue: () => f.value,
    isRequired: () => f.isRequired,
  };
}

function actionWith(fields: FakeField[]): ActionForm {
  return {
    tryToSetFields: async () => [],
    getFields: () => fields.map(fieldStub),
    getEnumField: (name: string) => ({
      getOptions: () => fields.find(f => f.name === name)?.enumValues,
    }),
    getLayout: () => ({ layout: [] }),
  };
}

describe('mapActionForm', () => {
  it('maps each field to name, type, value and isRequired', () => {
    const action = actionWith([{ name: 'reason', type: 'String', value: 'x', isRequired: true }]);

    const result = mapActionForm(action, [], []);

    expect(result.fields).toEqual([
      { name: 'reason', type: 'String', value: 'x', isRequired: true },
    ]);
  });

  it('emits enumValues only for Enum fields', () => {
    const action = actionWith([
      { name: 'reason', type: 'String', value: null, isRequired: false },
      { name: 'status', type: 'Enum', value: null, isRequired: false, enumValues: ['a', 'b'] },
    ]);

    const result = mapActionForm(action, [], []);

    expect(result.fields[0]).not.toHaveProperty('enumValues');
    expect(result.fields[1]).toMatchObject({ name: 'status', enumValues: ['a', 'b'] });
  });

  it('sets enumValues to null when an Enum field has no options', () => {
    const action = actionWith([{ name: 'status', type: 'Enum', value: null, isRequired: false }]);

    const result = mapActionForm(action, [], []);

    expect(result.fields[0].enumValues).toBeNull();
  });

  it('lists required fields whose resolved value is null or undefined and sets canExecute false', () => {
    const action = actionWith([
      { name: 'a', type: 'String', value: null, isRequired: true },
      { name: 'b', type: 'String', value: undefined, isRequired: true },
      { name: 'c', type: 'String', value: 'set', isRequired: true },
    ]);

    const result = mapActionForm(action, [], []);

    expect(result.requiredFields).toEqual(['a', 'b']);
    expect(result.canExecute).toBe(false);
  });

  it('treats an explicit empty string or 0 as present so canExecute is true', () => {
    const action = actionWith([
      { name: 'a', type: 'String', value: '', isRequired: true },
      { name: 'b', type: 'Number', value: 0, isRequired: true },
    ]);

    const result = mapActionForm(action, [], []);

    expect(result.requiredFields).toEqual([]);
    expect(result.canExecute).toBe(true);
  });

  it('passes skippedFields and layout through unchanged', () => {
    const layout = [{ component: 'page', elements: [] }] as never;
    const action = actionWith([]);

    const result = mapActionForm(action, ['ghost'], layout);

    expect(result.skippedFields).toEqual(['ghost']);
    expect(result.layout).toBe(layout);
  });
});
