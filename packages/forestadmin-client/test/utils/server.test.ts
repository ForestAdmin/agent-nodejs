import nock from 'nock';

import { ForbiddenError } from '../../src';
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

  it('should throw a ForbiddenError if the server returns a 403', async () => {
    nock(options.forestServerUrl)
      .get('/endpoint')
      .reply(403, { errors: [{ detail: 'project access forbidden' }] });

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toEqual(
      new ForbiddenError('project access forbidden'),
    );
  });

  it('should fail if project does not exists', async () => {
    nock(options.forestServerUrl)
      .get('/endpoint')
      .reply(404, { error: 'what is this env secret?' });

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(
      'Forest Admin server failed to find the project related to the envSecret you configured.' +
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
      'An unexpected error occurred while contacting the Forest Admin server. ' +
        'Please contact support@forestadmin.com for further investigations.',
    );
  });

  it('should fail if the server is offline', async () => {
    nock(options.forestServerUrl).get('/endpoint').reply(502, { error: 'bad proxy' });

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(
      'Failed to reach Forest Admin server. Are you online?',
    );
  });

  it('should fail if the certificate is invalid', async () => {
    nock(options.forestServerUrl)
      .get('/endpoint')
      .replyWithError(new Error('Certificate is invalid'));

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(
      'Forest Admin server TLS certificate cannot be verified. ' +
        'Please check that your system time is set properly. ' +
        'Original error: Certificate is invalid',
    );
  });

  it('should forward the error otherwise', async () => {
    const unknownError = new Error('unknown error');
    nock(options.forestServerUrl).get('/endpoint').replyWithError(unknownError);

    await expect(ServerUtils.query(options, 'get', '/endpoint')).rejects.toThrow(unknownError);
  });

  it('should timeout if the server take more than maxTimeAllowed to respond', async () => {
    const mockDate = new Date(1466424490000);
    const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    nock(options.forestServerUrl, {
      reqheaders: { 'x-foo': 'bar', 'forest-secret-key': options.envSecret },
    })
      .get('/endpoint')
      .reply(() => {
        return new Promise(resolve => {
          setTimeout(resolve, 110);
        });
      });

    await expect(
      ServerUtils.query(
        options,
        'get',
        '/endpoint',
        { 'x-foo': 'bar' },
        '',
        100, // maxTimeAllowed to respond
      ),
    ).rejects.toThrow(
      'The request to Forest Admin server has timed out while trying to reach http://forestadmin-server.com/endpoint at 2016-06-20T12:08:10.000Z. Message: Timeout of 100ms exceeded',
    );
    spy.mockRestore();
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

  describe('queryWithBearerToken', () => {
    it('should make a request with Bearer token authorization', async () => {
      nock(options.forestServerUrl, {
        reqheaders: {
          Authorization: 'Bearer my-bearer-token',
          'x-custom': 'header',
        },
      })
        .post('/api/endpoint', { data: 'payload' })
        .reply(200, { result: 'success' });

      const result = await ServerUtils.queryWithBearerToken({
        forestServerUrl: options.forestServerUrl,
        method: 'post',
        path: '/api/endpoint',
        bearerToken: 'my-bearer-token',
        headers: { 'x-custom': 'header' },
        body: { data: 'payload' },
      });

      expect(result).toStrictEqual({ result: 'success' });
    });

    it('should make a PATCH request', async () => {
      nock(options.forestServerUrl, {
        reqheaders: { Authorization: 'Bearer my-token' },
      })
        .patch('/api/resource/123')
        .reply(200, { updated: true });

      const result = await ServerUtils.queryWithBearerToken({
        forestServerUrl: options.forestServerUrl,
        method: 'patch',
        path: '/api/resource/123',
        bearerToken: 'my-token',
      });

      expect(result).toStrictEqual({ updated: true });
    });

    it('should handle errors with Bearer token requests', async () => {
      nock(options.forestServerUrl)
        .post('/api/endpoint')
        .reply(403, { errors: [{ detail: 'unauthorized access' }] });

      await expect(
        ServerUtils.queryWithBearerToken({
          forestServerUrl: options.forestServerUrl,
          method: 'post',
          path: '/api/endpoint',
          bearerToken: 'invalid-token',
        }),
      ).rejects.toEqual(new ForbiddenError('unauthorized access'));
    });
  });
});
