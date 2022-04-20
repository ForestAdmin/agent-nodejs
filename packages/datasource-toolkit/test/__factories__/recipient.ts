import { Factory } from 'fishery';
import { QueryRecipient } from '../../src/interfaces/user';

export default Factory.define<QueryRecipient>(() => ({
  email: 'user@domain.com',
  firstName: 'user',
  id: 1,
  lastName: 'domain',
  renderingId: 1,
  role: 'role',
  tags: {},
  team: 'team',
  timezone: 'Europe/Paris',
}));
