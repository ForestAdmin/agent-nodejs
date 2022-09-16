import { Factory } from 'fishery';

import AuthorizationService from '../../../../src/agent/services/authorization/authorization';
import actionPermissionsFactory from './internal/action-permission';

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
