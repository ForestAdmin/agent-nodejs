import { Factory } from 'fishery';

import ContextVariablesInstantiator from '../../../src/utils/context-variables-instantiator';
import renderingPermissionsFactory from '../permissions/rendering-permission';

export class ContextVariablesInstantiatorFactory extends Factory<ContextVariablesInstantiator> {
  mockAllMethods() {
    return this.afterBuild(contextVariablesInstantiator => {
      contextVariablesInstantiator.buildContextVariables = jest.fn();
    });
  }
}

const contextVariablesInstantiatorFactory = ContextVariablesInstantiatorFactory.define(
  () => new ContextVariablesInstantiator(renderingPermissionsFactory.build()),
);

export default contextVariablesInstantiatorFactory;
