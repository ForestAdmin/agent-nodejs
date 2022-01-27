import { Factory } from 'fishery';
import {
  Action,
  ActionResponse,
  ActionForm,
  ActionResponseType,
} from '../../dist/interfaces/action';

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
