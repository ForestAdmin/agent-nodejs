import nock from 'nock';
import superagent from 'superagent';
import agent from '../src/agent';

describe('agent', () => {
  test('should start a server on port 3351', async () => {
    nock('https://api.development.forestadmin.com')
      .get('/oidc/.well-known/openid-configuration')
      .reply(200, {
        registration_endpoint: 'https://fake-registration-endpoint.org',
      });

    nock('https://fake-registration-endpoint.org').post('/').reply(201, { client_id: 'xx' });

    const stop = await agent(3352, 'localhost', {
      prefix: '/forest',
      authSecret: 'xxx',
      envSecret: 'yyy',
      forestServerUrl: 'https://api.development.forestadmin.com',
      agentUrl: 'http://localhost:3352',
    });
    const response = await superagent.get('http://localhost:3352/forest/');

    stop();

    expect(response.status).toBe(200);
  });
});
