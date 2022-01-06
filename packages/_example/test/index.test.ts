import nock from 'nock';
import superagent from 'superagent';
import start from '../src/index';

describe('index', () => {
  test('should start a server on port 3351', async () => {
    nock('https://api.development.forestadmin.com')
      .get('/oidc/.well-known/openid-configuration')
      .reply(200, {
        registration_endpoint: 'https://fake-registration-endpoint.org',
      });

    nock('https://fake-registration-endpoint.org').post('/').reply(201, { client_id: 'xx' });

    const stop = await start();
    const response = await superagent.get('http://127.0.0.1:3351/forest/');
    stop();

    expect(response.status).toBe(200);
  });
});
