import { RootRoutesCtor, CollectionRoutesCtor } from '../../dist/routes/index';

import Authentication from '../../dist/routes/security/authentication';
import HealthCheck from '../../dist/routes/healthcheck';

import List from '../../dist/routes/access/list';
import Count from '../../dist/routes/access/count';
import Get from '../../dist/routes/access/get';

describe('RoutesCtor', () => {
  describe('RootRoutesCtor', () => {
    test('should export the required routes', () => {
      expect(RootRoutesCtor).toContain(Authentication);
      expect(RootRoutesCtor).toContain(HealthCheck);
    });
  });

  describe('CollectionRoutesCtor', () => {
    test('should export the required routes', () => {
      expect(CollectionRoutesCtor).toContain(List);
      expect(CollectionRoutesCtor).toContain(Count);
      expect(CollectionRoutesCtor).toContain(Get);
    });
  });
});
