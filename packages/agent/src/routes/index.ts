import Authentication from './authentication';
import HealthCheck from './healthcheck';
import List from './list';
import Count from './count';

export default {
  root: [Authentication, HealthCheck],
  models: [List, Count],
};
