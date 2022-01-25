import { RootRoutesCtor, CollectionRoutesCtor } from '../../dist/routes/index';

import Authentication from '../../dist/routes/security/authentication';
import HealthCheck from '../../dist/routes/healthcheck';

import Count from '../../dist/routes/access/count';
import Create from '../../dist/routes/modification/create';
import Delete from '../../dist/routes/modification/delete';
import Get from '../../dist/routes/access/get';
import List from '../../dist/routes/access/list';

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
      expect(CollectionRoutesCtor).toContain(Delete);
      expect(CollectionRoutesCtor).toContain(Create);
    });
  });
});
