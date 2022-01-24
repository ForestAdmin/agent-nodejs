import { RootRoutesCtor, CollectionRoutesCtor } from '../../src/routes/index';

import Authentication from '../../src/routes/security/authentication';
import HealthCheck from '../../src/routes/healthcheck';

import List from '../../src/routes/access/list';
import Count from '../../src/routes/access/count';
import Get from '../../src/routes/access/get';

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
