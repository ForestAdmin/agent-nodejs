import nock from 'nock';

import ServerUtils from '../../src/utils/server';

const options = { envSecret: '123', forestServerUrl: 'http://forestadmin-server.com' };

describe('ServerUtils', () => {
  it('should allow to make a GET query', async () => {
    nock(options.forestServerUrl, {
      reqheaders: { 'x-foo': 'bar', 'forest-secret-key': options.envSecret },
    })
      .get('/endpoint')
      .reply(200, { data: 'ok' });

    const result = await ServerUtils.query(options, 'get', '/endpoint', { 'x-foo': 'bar' });
    expect(result).toStrictEqual({ data: 'ok' });
  });

  it('should allow to make a POST query with body and headers', async () => {
    nock(options.forestServerUrl, {
      reqheaders: { 'x-foo': 'bar', 'forest-secret-key': options.envSecret },
    })
      .post('/endpoint', { data: 'ok' })
      .reply(200, { data: 'ok' });

    const result = await ServerUtils.query(
      options,
      'post',
      '/endpoint',
      { 'x-foo': 'bar' },
      { data: 'ok' },
    );

    expect(result).toStrictEqual({ data: 'ok' });
  });

  it('should fail if project does not exists', async () => {
    nock(options.forestServerUrl)
      .get('/endpoint')
      .reply(404, { error: 'what is this env secret?' });

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(
      'ForestAdmin server failed to find the project related to the envSecret you configured.' +
        ' Can you check that you copied it properly in the Forest initialization?',
    );
  });

  it('should fail if forest is in maintenance', async () => {
    nock(options.forestServerUrl)
      .get('/endpoint')
      .reply(503, { error: 'i am in maintenance mode' });

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(
      'Forest is in maintenance for a few minutes. We are upgrading your experience in ' +
        'the forest. We just need a few more minutes to get it right.',
    );
  });

  it('should default to a message for other http errors', async () => {
    nock(options.forestServerUrl).get('/endpoint').reply(418, { error: 'i am a teapot' });

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(
      'An unexpected error occurred while contacting the ForestAdmin server. ' +
        'Please contact support@forestadmin.com for further investigations.',
    );
  });

  it('should fail if the server is offline', async () => {
    nock(options.forestServerUrl).get('/endpoint').reply(502, { error: 'bad proxy' });

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(
      'Failed to reach ForestAdmin server. Are you online?',
    );
  });

  it('should fail if the certificate is invalid', async () => {
    nock(options.forestServerUrl)
      .get('/endpoint')
      .replyWithError(new Error('Certificate is invalid'));

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(
      'ForestAdmin server TLS certificate cannot be verified. ' +
        'Please check that your system time is set properly.',
    );
  });

  it('should forward the error otherwise', async () => {
    const unknownError = new Error('unknown error');
    nock(options.forestServerUrl).get('/endpoint').replyWithError(unknownError);

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(unknownError);
  });

  describe('when the server send back a message', () => {
    it('should forward a new error containing the message', async () => {
      const message = 'this is a message sent from forest server';
      nock(options.forestServerUrl)
        .get('/endpoint')
        .reply(424, { errors: [{ detail: message }] });

      await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(message);
    });
  });
});
