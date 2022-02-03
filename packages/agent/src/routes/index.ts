import Authentication from './security/authentication';
import Count from './access/count';
import CountRelatedRoute from './access/count-related';
import Create from './modification/create';
import Delete from './modification/delete';
import Get from './access/get';
import HealthCheck from './healthcheck';
import List from './access/list';
import Update from './modification/update';
import { RouteCtor } from './routes-factory';

export const RootRoutesCtor: RouteCtor[] = [Authentication, HealthCheck];
export const CollectionRoutesCtor: RouteCtor[] = [Count, Create, Delete, Get, List, Update];
export const RelatedRoutesCtor: RouteCtor[] = [CountRelatedRoute];
