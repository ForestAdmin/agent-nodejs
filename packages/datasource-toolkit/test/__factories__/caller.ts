import { Factory } from 'fishery';

import { Caller } from '../../src/interfaces/caller';

export default Factory.define<Caller>(() => ({
  email: 'user@domain.com',
  firstName: 'user',
  id: 1,
  lastName: 'domain',
  renderingId: 1,
  requestId: '00000000-0000-0000-0000-000000000000',
  request: { ip: '::1' },
  role: 'role',
  tags: {},
  team: 'team',
  environment: 'environment',
  project: 'project',
  permissionLevel: 'developer',
  timezone: 'Europe/Paris',
}));
