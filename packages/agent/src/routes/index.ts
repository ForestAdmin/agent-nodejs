import Authentication from './authentication';
import HealthCheck from './healthcheck';
import List from './access/list';
import Count from './access/count';
import Get from './access/get';

export const RootRoutesCtor = [Authentication, HealthCheck];
export const CollectionRoutesCtor = [List, Count, Get];
