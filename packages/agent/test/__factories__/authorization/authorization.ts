import { Factory } from 'fishery';

import AuthorizationService from '../../../src/services/authorization/authorization';
import forestAdminClientFactory from '../forest-admin-client';

export class AuthorizationsFactory extends Factory<AuthorizationService> {
  mockAllMethods() {
    return this.afterBuild(Authorizations => {
      Authorizations.assertCanBrowse = jest.fn();
      Authorizations.assertCanRead = jest.fn();
      Authorizations.assertCanAdd = jest.fn();
      Authorizations.assertCanEdit = jest.fn();
      Authorizations.assertCanDelete = jest.fn();
      Authorizations.assertCanExport = jest.fn();
      Authorizations.getScope = jest.fn();
      Authorizations.assertCanExecuteChart = jest.fn();
      Authorizations.invalidateScopeCache = jest.fn();
    });
  }
}

const authorizationServiceFactory = AuthorizationsFactory.define(
  () => new AuthorizationService(forestAdminClientFactory.build()),
);

export default authorizationServiceFactory;
