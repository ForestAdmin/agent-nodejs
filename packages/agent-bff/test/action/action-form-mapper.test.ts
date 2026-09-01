import type { ActionForm, ActionFormField } from '../../src/action/agent-action-client';
import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import { mapActionForm } from '../../src/action/action-form-mapper';

const logger = jest.fn();

beforeEach(() => logger.mockClear());

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
    getReference: () => null,
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

function mapForm(
  action: ActionForm,
  skippedFields: string[] = [],
  layout: ForestServerActionFormLayoutElement[] = [],
) {
  return mapActionForm(action, skippedFields, layout, logger);
}

describe('mapActionForm', () => {
  it('maps each field to name, type, value and isRequired', () => {
    const action = actionWith([{ name: 'reason', type: 'String', value: 'x', isRequired: true }]);

    const result = mapForm(action, [], []);

    expect(result.fields).toEqual([
      { name: 'reason', type: 'String', value: 'x', isRequired: true },
    ]);
  });

  it('emits enumValues only for Enum fields', () => {
    const action = actionWith([
      { name: 'reason', type: 'String', value: null, isRequired: false },
      { name: 'status', type: 'Enum', value: null, isRequired: false, enumValues: ['a', 'b'] },
    ]);

    const result = mapForm(action, [], []);

    expect(result.fields[0]).not.toHaveProperty('enumValues');
    expect(result.fields[1]).toMatchObject({ name: 'status', enumValues: ['a', 'b'] });
  });

  it('emits enumValues for a legacy EnumList field, which the execute validator checks', () => {
    const action = actionWith([
      { name: 'tiers', type: 'EnumList', value: null, isRequired: false, enumValues: ['a', 'b'] },
    ]);

    const result = mapActionForm(action, [], []);

    expect(result.fields[0]).toMatchObject({ name: 'tiers', enumValues: ['a', 'b'] });
  });

  it('sets enumValues to null when an Enum field has no options', () => {
    const action = actionWith([{ name: 'status', type: 'Enum', value: null, isRequired: false }]);

    const result = mapForm(action, [], []);

    expect(result.fields[0].enumValues).toBeNull();
  });

  it('lists required fields whose resolved value is null or undefined and sets canExecute false', () => {
    const action = actionWith([
      { name: 'a', type: 'String', value: null, isRequired: true },
      { name: 'b', type: 'String', value: undefined, isRequired: true },
      { name: 'c', type: 'String', value: 'set', isRequired: true },
    ]);

    const result = mapForm(action, [], []);

    expect(result.requiredFields).toEqual(['a', 'b']);
    expect(result.canExecute).toBe(false);
  });

  it('treats an explicit empty string or 0 as present so canExecute is true', () => {
    const action = actionWith([
      { name: 'a', type: 'String', value: '', isRequired: true },
      { name: 'b', type: 'Number', value: 0, isRequired: true },
    ]);

    const result = mapForm(action, [], []);

    expect(result.requiredFields).toEqual([]);
    expect(result.canExecute).toBe(true);
  });

  it('passes skippedFields and non-html layout elements through unchanged', () => {
    const layout = [{ component: 'page', elements: [] }] as never;
    const action = actionWith([]);

    const result = mapForm(action, ['ghost'], layout);

    expect(result.skippedFields).toEqual(['ghost']);
    expect(result.layout).toEqual([{ component: 'page', elements: [] }]);
  });

  it('sanitizes htmlBlock content: safe markup kept, active markup stripped', () => {
    const layout = [
      {
        component: 'htmlBlock',
        content: '<p>Safe <b>markup</b></p><img src=x onerror="alert(1)"><script>alert(2)</script>',
      },
    ] as never;

    const result = mapForm(actionWith([]), [], layout);

    expect(result.layout).toEqual([
      { component: 'htmlBlock', content: '<p>Safe <b>markup</b></p>' },
    ]);
  });

  it('sanitizes htmlBlock content nested inside a page', () => {
    const layout = [
      {
        component: 'page',
        elements: [{ component: 'htmlBlock', content: '<svg onload="alert(1)"></svg><i>ok</i>' }],
      },
    ] as never;

    const result = mapForm(actionWith([]), [], layout);

    expect(result.layout).toEqual([
      { component: 'page', elements: [{ component: 'htmlBlock', content: '<i>ok</i>' }] },
    ]);
  });

  it('drops the elements of a page nested deeper than the sanitizable depth', () => {
    const deepest = { component: 'htmlBlock', content: '<script>alert(1)</script>' };
    const layout = [
      Array.from({ length: 12 }).reduce(
        (inner: unknown) => ({ component: 'page', elements: [inner] }),
        deepest,
      ),
    ] as never;

    const result = JSON.stringify(mapForm(actionWith([]), [], layout).layout);

    expect(result).not.toContain('script');
    expect(result).toContain('"elements":[]');
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      'Action layout elements dropped: nested deeper than the sanitizable depth',
      { limit: 10 },
    );
  });

  it('empties an htmlBlock whose content is not a string', () => {
    const layout = [{ component: 'htmlBlock', content: { evil: 1 } }] as never;

    expect(mapForm(actionWith([]), [], layout).layout).toEqual([
      { component: 'htmlBlock', content: '' },
    ]);
  });

  it('keeps presentational inline styles on an htmlBlock', () => {
    const layout = [
      {
        component: 'htmlBlock',
        content: '<div style="background:#16a34a;color:#fff;padding:12px">KYC Approved</div>',
      },
    ] as never;

    const result = mapForm(actionWith([]), [], layout);

    expect(result.layout).toEqual([
      {
        component: 'htmlBlock',
        content: '<div style="background:#16a34a;color:#fff;padding:12px">KYC Approved</div>',
      },
    ]);
  });

  it('drops style properties that can overlay the host page or carry a url', () => {
    const layout = [
      {
        component: 'htmlBlock',
        content:
          '<div style="position:fixed;top:0;z-index:9999;background:url(javascript:alert(1))">x</div>',
      },
    ] as never;

    const result = mapForm(actionWith([]), [], layout);

    expect(result.layout).toEqual([{ component: 'htmlBlock', content: '<div>x</div>' }]);
  });

  it('leaves a malformed layout element untouched instead of throwing', () => {
    const layout = [null, { component: 'page', elements: 'nope' }] as never;

    const result = mapForm(actionWith([]), [], layout);

    expect(result.layout).toEqual([null, { component: 'page', elements: 'nope' }]);
  });

  it('keeps forest utility classes on an htmlBlock and drops the others', () => {
    const layout = [
      {
        component: 'htmlBlock',
        content: '<p class="c-clr-1-4 l-mt modal">x</p><p class="ember-view">y</p>',
      },
    ] as never;

    const result = mapForm(actionWith([]), [], layout);

    expect(result.layout).toEqual([
      { component: 'htmlBlock', content: '<p class="c-clr-1-4 l-mt">x</p><p>y</p>' },
    ]);
  });

  it('truncates an htmlBlock to the remaining total layout html budget and logs it', () => {
    const layout = [
      { component: 'htmlBlock', content: 'a'.repeat(262140) },
      { component: 'htmlBlock', content: '<p>bcdef</p><script>alert(1)</script>' },
    ] as never;

    const result = mapForm(actionWith([]), [], layout);

    expect(result.layout).toEqual([
      { component: 'htmlBlock', content: 'a'.repeat(262140) },
      { component: 'htmlBlock', content: '<p>b</p>' },
    ]);
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      'Action layout html truncated: total layout html longer than the sanitizable size',
      { characters: 37, remaining: 4, limit: 262144 },
    );
  });

  it('empties htmlBlocks once the total layout html budget is spent', () => {
    const layout = [
      { component: 'htmlBlock', content: 'x'.repeat(262144) },
      { component: 'htmlBlock', content: '<p>after</p>' },
      {
        component: 'page',
        elements: [{ component: 'htmlBlock', content: '<i>nested</i>' }],
      },
    ] as never;

    const result = mapForm(actionWith([]), [], layout);

    expect(result.layout).toEqual([
      { component: 'htmlBlock', content: 'x'.repeat(262144) },
      { component: 'htmlBlock', content: '' },
      { component: 'page', elements: [{ component: 'htmlBlock', content: '' }] },
    ]);
  });

  it('empties an htmlBlock whose content is entirely active markup', () => {
    const layout = [{ component: 'htmlBlock', content: '<script>alert(1)</script>' }] as never;

    const result = mapForm(actionWith([]), [], layout);

    expect(result.layout).toEqual([{ component: 'htmlBlock', content: '' }]);
  });
});
