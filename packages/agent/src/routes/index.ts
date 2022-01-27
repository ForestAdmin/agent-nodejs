import Authentication from './security/authentication';
import HealthCheck from './healthcheck';
import List from './access/list';
import Count from './access/count';
import Get from './access/get';
import Delete from './modification/delete';

export const RootRoutesCtor = [Authentication, HealthCheck];
export const CollectionRoutesCtor = [List, Count, Get, Delete];
