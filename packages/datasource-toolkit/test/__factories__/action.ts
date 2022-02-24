import { Factory } from 'fishery';

import { Action, ActionField, ActionResult, ActionResultType } from '../../src/interfaces/action';

class ConcreteAction implements Action {
  async execute(): Promise<ActionResult> {
    return {
      type: ActionResultType.Redirect,
      path: 'https://test.com',
    };
  }

  async getForm(): Promise<ActionField[]> {
    return [];
  }
}

export default Factory.define<Action>(() => new ConcreteAction());
