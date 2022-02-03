import { Factory } from 'fishery';
import superagent from 'superagent';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class SuperAgentFactory extends Factory<any> {
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
