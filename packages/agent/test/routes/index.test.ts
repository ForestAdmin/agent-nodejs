import { RootRoutesCtor, CollectionRoutesCtor } from '../../src/routes/index';

import Authentication from '../../src/routes/security/authentication';
import HealthCheck from '../../src/routes/healthcheck';

import Count from '../../src/routes/access/count';
import Create from '../../src/routes/modification/create';
import Delete from '../../src/routes/modification/delete';
import Get from '../../src/routes/access/get';
import List from '../../src/routes/access/list';
import Update from '../../src/routes/modification/update';

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
