import type { DataSourceFactory } from '@forestadmin/datasource-toolkit';

import * as agent from '@forestadmin/agent';
import * as datasourceSQL from '@forestadmin/datasource-sql';

import generateOrUpdateTypings from '../../src/services/typings-updater';

describe('generateOrUpdateTypings', () => {
  it('should create an agent and to generate typings from introspection', () => {
    const updateTypesOnFileSystemMock = jest.fn();
    const createStandaloneAgentMock = jest.spyOn(agent, 'createAgent').mockReturnValue({
      addDataSource: jest.fn(),
      updateTypesOnFileSystem: updateTypesOnFileSystemMock,
    } as unknown as agent.Agent);
    const datasourceSQLMock = jest
      .spyOn(datasourceSQL, 'createSqlDataSource')
      .mockReturnValue(Symbol('datasource') as unknown as DataSourceFactory);

    generateOrUpdateTypings();
    expect(datasourceSQLMock).toHaveBeenCalledWith(
      `sqlite::memory:`,
      expect.objectContaining({ introspection: expect.any(Object) }),
    );
    expect(createStandaloneAgentMock).toHaveBeenCalled();
    expect(updateTypesOnFileSystemMock).toHaveBeenCalledWith('typings.d.ts', 5);
  });
});
