import { Factory } from 'fishery';

import { Caller } from '../../src/interfaces/caller';

export default Factory.define<Caller>(() => ({
  email: 'user@domain.com',
  firstName: 'user',
  id: 1,
  lastName: 'domain',
  renderingId: 1,
  role: 'role',
  tags: {},
  team: 'team',
  timezone: 'Europe/Paris',
  from: 'ListView',
}));
