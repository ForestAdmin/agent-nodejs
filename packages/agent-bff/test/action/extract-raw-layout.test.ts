import type { ActionForm } from '../../src/action/agent-action-client';

import ActionLayoutRoot from '@forestadmin/agent-client/dist/action-layout/action-layout-root';

import { extractRawLayout } from '../../src/action/agent-action-client';

function actionReturning(layout: unknown): ActionForm {
  return { getLayout: () => layout } as unknown as ActionForm;
}

describe('extractRawLayout', () => {
  it('unwraps the element array from a real agent-client ActionLayoutRoot', () => {
    const elements = [{ component: 'input', fieldId: 'reason' }, { component: 'separator' }];

    const result = extractRawLayout(actionReturning(new ActionLayoutRoot(elements as never)));

    expect(result).toEqual(elements);
  });

  it('falls back to an empty array when the layout exposes no element array', () => {
    expect(extractRawLayout(actionReturning({}))).toEqual([]);
  });
});
