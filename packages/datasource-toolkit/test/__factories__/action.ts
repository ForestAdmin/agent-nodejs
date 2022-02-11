import { Factory } from 'fishery';

import {
  Action,
  ActionForm,
  ActionResponse,
  ActionResponseType,
} from '../../src/interfaces/action';

class ConcreteAction implements Action {
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

export default Factory.define<Action>(() => new ConcreteAction());
