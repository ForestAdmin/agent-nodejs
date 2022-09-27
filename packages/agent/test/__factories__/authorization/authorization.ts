import { Factory } from 'fishery';

import AuthorizationService from '../../../src/services/authorization/authorization';
import actionPermissionsFactory from './internal/action-permission';
import renderingPermissionsFactory from './internal/rendering-permission';

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
      Authorizations.getScope = jest.fn();
      Authorizations.assertCanRetrieveChart = jest.fn();
      Authorizations.invalidateScopeCache = jest.fn();
    });
  }
}

const authorizationServiceFactory = AuthorizationsFactory.define(
  () =>
    new AuthorizationService(actionPermissionsFactory.build(), renderingPermissionsFactory.build()),
);

export default authorizationServiceFactory;
