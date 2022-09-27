import { Factory } from 'fishery';

import AuthorizationService from '../../../src/services/authorization/authorization';
import actionPermissionsFactory from './internal/action-permission';

export class AuthorizationsFactory extends Factory<AuthorizationService> {
  mockAllMethods() {
    return this.afterBuild(Authorizations => {
      Authorizations.assertCanExecuteCustomAction = jest.fn();
      Authorizations.assertCanBrowse = jest.fn();
      Authorizations.assertCanRead = jest.fn();
      Authorizations.assertCanAdd = jest.fn();
      Authorizations.assertCanEdit = jest.fn();
      Authorizations.assertCanDelete = jest.fn();
      Authorizations.assertCanExport = jest.fn();
    });
  }
}

export default AuthorizationsFactory.define(
  () => new AuthorizationService(actionPermissionsFactory.build()),
);
