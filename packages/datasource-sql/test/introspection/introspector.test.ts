import {
  AccessDeniedError,
  ConnectionAcquireTimeoutError,
  ConnectionTimedOutError,
  HostNotFoundError,
  InvalidConnectionError,
  Sequelize,
} from 'sequelize';

import Introspector from '../../src/introspection/introspector';

describe('Introspector', () => {
  const anUri = 'postgres://localhost:5432/forest';

  const aLogger = () => {};

  describe('when the connection is not found', () => {
    it('should throw an error', async () => {
      const sequelize = new Sequelize(anUri);
      sequelize.getQueryInterface = jest.fn(() => {
        throw new HostNotFoundError(new Error('anError'));
      });

      await expect(() => Introspector.introspect(sequelize, aLogger)).rejects.toThrow(
        'Host not found error: anError',
      );
    });
  });

  describe('when the access is denied', () => {
    it('should throw an error', async () => {
      const sequelize = new Sequelize(anUri);
      sequelize.getQueryInterface = jest.fn(() => {
        throw new AccessDeniedError(new Error('anError'));
      });

      await expect(() => Introspector.introspect(sequelize, aLogger)).rejects.toThrow(
        'Access denied: anError',
      );
    });
  });

  describe('when the connection acquire is in timeout', () => {
    it('should throw an error', async () => {
      const sequelize = new Sequelize(anUri);
      sequelize.getQueryInterface = jest.fn(() => {
        throw new ConnectionAcquireTimeoutError(new Error('anError'));
      });

      await expect(() => Introspector.introspect(sequelize, aLogger)).rejects.toThrow(
        'Connection acquire timeout: anError',
      );
    });
  });

  describe('when the connection is timed out', () => {
    it('should throw an error', async () => {
      const sequelize = new Sequelize(anUri);
      sequelize.getQueryInterface = jest.fn(() => {
        throw new ConnectionTimedOutError(new Error('anError'));
      });

      await expect(() => Introspector.introspect(sequelize, aLogger)).rejects.toThrow(
        'Connection timed out: anError',
      );
    });
  });

  describe('when the connection is invalid', () => {
    it('should throw an error', async () => {
      const sequelize = new Sequelize(anUri);
      sequelize.getQueryInterface = jest.fn(() => {
        throw new InvalidConnectionError(new Error('anError'));
      });

      await expect(() => Introspector.introspect(sequelize, aLogger)).rejects.toThrow(
        'Invalid connection: anError',
      );
    });
  });

  describe('when the error is not caught by sequelize', () => {
    it('should throw an error', async () => {
      const sequelize = new Sequelize(anUri);
      sequelize.getQueryInterface = jest.fn(() => {
        throw new Error('anError');
      });

      await expect(() => Introspector.introspect(sequelize, aLogger)).rejects.toThrow(
        'Connection error: anError',
      );
    });
  });
});
