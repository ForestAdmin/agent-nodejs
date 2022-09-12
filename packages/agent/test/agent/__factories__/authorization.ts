import { Factory } from 'fishery';

import AuthorizationService from '../../../src/agent/services/authorization';
import actionPermissionsFactory from './permissions/action-permission';

export class AuthorizationsFactory extends Factory<AuthorizationService> {
  mockAllMethods() {
    return this.afterBuild(Authorizations => {
      Authorizations.assertCanExecuteCustomAction = jest.fn();
      Authorizations.assertCanOnCollection = jest.fn();
    });
  }
}

export default AuthorizationsFactory.define(
  () => new AuthorizationService(actionPermissionsFactory.build()),
);
