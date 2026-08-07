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

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
