import Authentication from './security/authentication';
import Count from './access/count';
import Create from './modification/create';
import Delete from './modification/delete';
import Get from './access/get';
import HealthCheck from './healthcheck';
import List from './access/list';

export const RootRoutesCtor = [Authentication, HealthCheck];
export const CollectionRoutesCtor = [Count, Create, Delete, Get, List];
