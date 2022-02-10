import { Factory } from 'fishery';
import Scope from '../../src/services/scope';

export default Factory.define<Scope>(
  () =>
    new Scope({
      envSecret: '123',
      forestServerUrl: 'http://api',
      scopesCacheDurationInSeconds: 15 * 60,
    }),
);
