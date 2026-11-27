import type { SchemaAction } from '../../src/schema/action-endpoints';

import actionEndpointsFromSchema from '../../src/schema/action-endpoints';

const sendEmail: SchemaAction = {
  id: 'users-send-email',
  name: 'Send email',
  endpoint: '/forest/_actions/users/0/send-email',
  hooks: { load: true, change: ['subject'] },
  fields: [{ field: 'subject', type: 'String' }] as SchemaAction['fields'],
  layout: [{ component: 'input', fieldId: 'subject' }] as SchemaAction['layout'],
};

describe('actionEndpointsFromSchema', () => {
  it('should map each callable action by collection and name', () => {
    expect(actionEndpointsFromSchema([{ name: 'users', actions: [sendEmail] }])).toEqual({
      users: {
        'Send email': {
          id: 'users-send-email',
          name: 'Send email',
          endpoint: '/forest/_actions/users/0/send-email',
          hooks: { load: true, change: ['subject'] },
          fields: [{ field: 'subject', type: 'String' }],
          layout: [{ component: 'input', fieldId: 'subject' }],
        },
      },
    });
  });

  it('should leave hooks and fields absent when the schema omits them', () => {
    const legacy = { id: 'x', name: 'Legacy', endpoint: '/forest/legacy' };

    const { users } = actionEndpointsFromSchema([{ name: 'users', actions: [legacy] }]);

    expect(users.Legacy.hooks).toBeUndefined();
    expect(users.Legacy.fields).toBeUndefined();
  });

  it('should skip an action without endpoint and a collection without callable action', () => {
    const endpoints = actionEndpointsFromSchema([
      { name: 'users', actions: [{ ...sendEmail, endpoint: '' }] },
      { name: 'orders' },
    ]);

    expect(Object.keys(endpoints)).toEqual([]);
  });

  it('should copy the schema so a caller cannot change it through the endpoints', () => {
    const action = structuredClone(sendEmail);

    const { users } = actionEndpointsFromSchema([{ name: 'users', actions: [action] }]);
    users['Send email'].fields[0].field = 'changed';

    expect(action.fields[0].field).toBe('subject');
  });

  it('should resolve no inherited member as a collection or an action', () => {
    const endpoints = actionEndpointsFromSchema([{ name: 'users', actions: [sendEmail] }]);

    expect(endpoints.toString).toBeUndefined();
    expect(endpoints.users.constructor).toBeUndefined();
  });
});
