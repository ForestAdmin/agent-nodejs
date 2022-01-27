import { RootRoutesCtor, CollectionRoutesCtor } from '../../dist/routes/index';

import Authentication from '../../dist/routes/security/authentication';
import HealthCheck from '../../dist/routes/healthcheck';

import Count from '../../dist/routes/access/count';
import Create from '../../dist/routes/modification/create';
import Delete from '../../dist/routes/modification/delete';
import Get from '../../dist/routes/access/get';
import List from '../../dist/routes/access/list';
import Update from '../../dist/routes/modification/update';

describe('RoutesCtor', () => {
  describe('RootRoutesCtor', () => {
    test('should export the required routes', () => {
      expect(RootRoutesCtor).toContain(Authentication);
      expect(RootRoutesCtor).toContain(HealthCheck);
    });
  });

  describe('CollectionRoutesCtor', () => {
    describe.each([Count, Create, Delete, Get, List, Update])('the route', route => {
      it('should be defined', () => {
        expect(CollectionRoutesCtor).toContain(route);
      });
    });
  });
});
