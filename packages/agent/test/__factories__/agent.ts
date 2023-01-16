import { Factory } from 'fishery';

import forestAdminHttpDriverOptions from './forest-admin-http-driver-options';
import Agent from '../../src/agent';

export default Factory.define<Agent>(() => new Agent(forestAdminHttpDriverOptions.build()));
