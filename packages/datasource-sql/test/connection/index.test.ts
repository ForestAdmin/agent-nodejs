import { Sequelize } from 'sequelize';

import { connect } from '../../src/connection';
import { SslMode } from '../../src/types';
import setupDatabaseWithTypes from '../_helpers/setup-using-all-types';

describe('Connect', () => {
  beforeAll(async () => {
    await setupDatabaseWithTypes(
      'postgres://test:password@localhost:5443',
      'postgres',
      'test_connection',
    );
  });

  it('should work when credentials are correct', async () => {
    const seq = await connect('postgres://test:password@localhost:5443/test_connection');
    await seq.close();

    expect(seq).toBeInstanceOf(Sequelize);
  });

  it.each([['preferred'], ['disabled']])('should work when using sslMode %s', async sslMode => {
    const seq = await connect({
      uri: 'postgres://test:password@localhost:5443/test_connection',
      sslMode: sslMode as SslMode,
    });

    await seq.close();

    expect(seq).toBeInstanceOf(Sequelize);
  });

  it.each([['required'], ['verify']])('should fail when using sslMode %s', async sslMode => {
    const fn = () =>
      connect({
        uri: 'postgres://test:password@localhost:5443/test_connection',
        sslMode: sslMode as SslMode,
      });

    await expect(fn).rejects.toThrow(
      'Connection error: The server does not support SSL connections',
    );
  });

  it('should throw when hostname is unknown and using preferred ssl', async () => {
    const fn = () => connect({ uri: 'postgres://dontexist123123', sslMode: 'preferred' });
    await expect(fn).rejects.toThrow('Host not found error: getaddrinfo ENOTFOUND dontexist123123');
  });

  it('should throw when hostname is unknown', async () => {
    const fn = () => connect('postgres://dontexist123123');
    await expect(fn).rejects.toThrow('Host not found error: getaddrinfo ENOTFOUND dontexist123123');
  });

  it('should throw when port is not reachable', async () => {
    const fn = () => connect('postgres://localhost:23123');
    await expect(fn).rejects.toThrow('Connection refused error: connect ECONNREFUSED');
  });

  it('should throw when username is wrong', async () => {
    const fn = () => connect('postgres://unknownUser@localhost:5443');

    await expect(fn).rejects.toThrow(
      'Connection error: password authentication failed for user "unknownUser"',
    );
  });

  it('should throw when password is wrong', async () => {
    const fn = () => connect('postgres://test:wrongpassword@localhost:5443');

    await expect(fn).rejects.toThrow(
      'Connection error: password authentication failed for user "test"',
    );
  });

  it('should throw when database is wrong', async () => {
    const fn = () => connect('postgres://test:password@localhost:5443/unknownDatabase');

    await expect(fn).rejects.toThrow('Connection error: database "unknownDatabase" does not exist');
  });
});
