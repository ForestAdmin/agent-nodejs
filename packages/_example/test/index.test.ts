import nock from 'nock';
import superagent from 'superagent';

import agent from '../src/agent';

describe('agent', () => {
  test('should start a server on port 3352', async () => {
    nock('https://api.development.forestadmin.com')
      .get('/oidc/.well-known/openid-configuration')
      .reply(200, { registration_endpoint: 'https://fake-registration-endpoint.org' });

    nock('https://api.development.forestadmin.com')
      .post('/forest/apimaps/hashcheck')
      .reply(200, { sendSchema: false });

    nock('https://fake-registration-endpoint.org').post('/').reply(201, { client_id: 'xx' });

    const stop = await agent(3352, 'localhost', {
      prefix: '/forest',
      authSecret: 'xxx',
      envSecret: '61a31971206f285c3e8eb8f3ee420175eb004bfa9fa24846dde6d5dd438e3991',
      forestServerUrl: 'https://api.development.forestadmin.com',
      agentUrl: 'http://localhost:3352',
      isProduction: false,
      schemaPath: '/tmp/.testschema.json',
      logger: () => {},
    });
    const response = await superagent.get('http://localhost:3352/forest/');

    stop();

    expect(response.status).toBe(200);
  });
});
