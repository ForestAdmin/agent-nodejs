import { Factory } from 'fishery';

import Agent from '../../src/agent';
import forestAdminHttpDriverOptions from './forest-admin-http-driver-options';

export default Factory.define<Agent>(() => new Agent(forestAdminHttpDriverOptions.build()));
