import Authentication from './authentication';
import HealthCheck from './healthcheck';
import List from './list';
import Count from './count';

export const RootRoutesCtor = [Authentication, HealthCheck];
export const CollectionRoutesCtor = [List, Count];
