import BaseAction from '../src/base-action';
import { ActionForm, ActionResponse, ActionResponseType } from '../src/interfaces/action';

class ConcreteAction extends BaseAction {
  async execute(): Promise<ActionResponse> {
    return {
      type: ActionResponseType.Redirect,
      path: 'https://test.com',
    };
  }

  async getForm(): Promise<ActionForm> {
    return { fields: [] };
  }
}

describe('BaseAction', () => {
  it('should instanciate properly when extended', () => {
    expect(new ConcreteAction()).toBeDefined();
  });
});
