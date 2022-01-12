import { Factory } from 'fishery';
import superagent from 'superagent';

export class SuperAgentFactory extends Factory<superagent> {
  mockAllMethods() {
    return this.afterBuild(superagentInstance => {
      superagentInstance.set = jest.fn().mockReturnThis();
      superagentInstance.get = jest.fn().mockReturnThis();
      superagentInstance.send = jest.fn().mockReturnThis();
      superagentInstance.post = jest.fn().mockReturnThis();
    });
  }
}

export default SuperAgentFactory.define(() => superagent);
