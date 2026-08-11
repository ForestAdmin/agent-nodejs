import { ForestHttpApi } from '@forestadmin/forestadmin-client';

import PermissionsClient from '../../src/permissions/permissions-client';

const OPTIONS = { forestServerUrl: 'https://api.forestadmin.com', envSecret: 'env-secret' };

describe('PermissionsClient', () => {
  describe('when both permission endpoints resolve', () => {
    it('should query the environment and the users with the server options', async () => {
      const getEnvironmentPermissions = jest
        .spyOn(ForestHttpApi.prototype, 'getEnvironmentPermissions')
        .mockResolvedValue(true);
      const getUsers = jest
        .spyOn(ForestHttpApi.prototype, 'getUsers')
        .mockResolvedValue([{ id: 1, roleId: 7 }] as never);

      const result = await new PermissionsClient(OPTIONS).fetchPermissions();

      expect(getEnvironmentPermissions).toHaveBeenCalledWith(OPTIONS);
      expect(getUsers).toHaveBeenCalledWith(OPTIONS);
      expect(result).toEqual({
        environmentPermissions: true,
        users: [{ id: 1, roleId: 7 }],
      });
    });
  });

  describe('when the environment permissions fetch rejects', () => {
    it('should reject rather than returning a partial result', async () => {
      jest
        .spyOn(ForestHttpApi.prototype, 'getEnvironmentPermissions')
        .mockRejectedValue(new Error('SaaS down'));
      jest.spyOn(ForestHttpApi.prototype, 'getUsers').mockResolvedValue([] as never);

      await expect(new PermissionsClient(OPTIONS).fetchPermissions()).rejects.toThrow('SaaS down');
    });
  });

  describe('when the users fetch rejects', () => {
    it('should reject rather than returning a partial result', async () => {
      jest.spyOn(ForestHttpApi.prototype, 'getEnvironmentPermissions').mockResolvedValue(true);
      jest.spyOn(ForestHttpApi.prototype, 'getUsers').mockRejectedValue(new Error('users down'));

      await expect(new PermissionsClient(OPTIONS).fetchPermissions()).rejects.toThrow('users down');
    });
  });

  describe('when several callers miss the cache at the same time', () => {
    it('should query the server once and serve every caller from that call', async () => {
      let releaseEnvironment: (value: boolean) => void = () => {};

      const environmentPending = new Promise<boolean>(resolve => {
        releaseEnvironment = resolve;
      });
      const getEnvironmentPermissions = jest
        .spyOn(ForestHttpApi.prototype, 'getEnvironmentPermissions')
        .mockReturnValue(environmentPending as never);
      const getUsers = jest
        .spyOn(ForestHttpApi.prototype, 'getUsers')
        .mockResolvedValue([{ id: 1, roleId: 7 }] as never);

      const client = new PermissionsClient(OPTIONS);
      const inFlight = [
        client.fetchPermissions(),
        client.fetchPermissions(),
        client.fetchPermissions(),
      ];

      releaseEnvironment(true);
      const results = await Promise.all(inFlight);

      expect(getEnvironmentPermissions).toHaveBeenCalledTimes(1);
      expect(getUsers).toHaveBeenCalledTimes(1);
      results.forEach(result => {
        expect(result).toEqual({ environmentPermissions: true, users: [{ id: 1, roleId: 7 }] });
      });
    });
  });

  describe('when a shared fetch rejects', () => {
    it('should let the next caller retry instead of replaying the failure', async () => {
      const getEnvironmentPermissions = jest
        .spyOn(ForestHttpApi.prototype, 'getEnvironmentPermissions')
        .mockRejectedValueOnce(new Error('SaaS down'))
        .mockResolvedValue(true);
      jest
        .spyOn(ForestHttpApi.prototype, 'getUsers')
        .mockResolvedValue([{ id: 1, roleId: 7 }] as never);

      const client = new PermissionsClient(OPTIONS);

      await expect(client.fetchPermissions()).rejects.toThrow('SaaS down');
      await expect(client.fetchPermissions()).resolves.toEqual({
        environmentPermissions: true,
        users: [{ id: 1, roleId: 7 }],
      });
      expect(getEnvironmentPermissions).toHaveBeenCalledTimes(2);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
