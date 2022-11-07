import { Factory } from 'fishery';

import AuthorizationService from '../../../src/services/authorization/authorization';
import forestAdminClientFactory from '../forest-admin-client';

export class AuthorizationsFactory extends Factory<AuthorizationService> {
  mockAllMethods() {
    return this.afterBuild(Authorizations => {
      Authorizations.assertCanApproveCustomAction = jest.fn();
      Authorizations.assertCanRequestCustomActionParameters = jest.fn();
      Authorizations.assertCanTriggerCustomAction = jest.fn();
      Authorizations.assertCanBrowse = jest.fn();
      Authorizations.assertCanRead = jest.fn();
      Authorizations.assertCanAdd = jest.fn();
      Authorizations.assertCanEdit = jest.fn();
      Authorizations.assertCanDelete = jest.fn();
      Authorizations.assertCanExport = jest.fn();
      Authorizations.getScope = jest.fn();
      Authorizations.assertCanExecuteChart = jest.fn();
      Authorizations.invalidateScopeCache = jest.fn();
      Authorizations.verifySignedActionParameters = jest.fn();
    });
  }
}

const authorizationServiceFactory = AuthorizationsFactory.define(
  () => new AuthorizationService(forestAdminClientFactory.build()),
);

export default authorizationServiceFactory;
