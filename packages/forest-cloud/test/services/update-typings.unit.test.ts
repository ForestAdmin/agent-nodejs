import * as agent from '@forestadmin/agent';
import * as datasourceSQL from '@forestadmin/datasource-sql';
import { Table } from '@forestadmin/datasource-sql';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { BusinessError, CustomizationError } from '../../src/errors';
import BootstrapPathManager from '../../src/services/bootstrap-path-manager';
import DistPathManager from '../../src/services/dist-path-manager';
import { updateTypings, updateTypingsWithCustomizations } from '../../src/services/update-typings';

describe('update-typings', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  type Exit = (_code?: number | undefined) => never;

  function setup() {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as Exit);
    const introspection = { tables: [] } as unknown as Table[];
    const datasource = Symbol('datasource') as unknown as () => any;
    const agentMock = {
      addDataSource: jest.fn(),
      addChart: jest.fn(),
      updateTypesOnFileSystem: jest.fn(),
    } as unknown as agent.Agent;
    const createAgentSpy = jest.spyOn(agent, 'createAgent').mockReturnValue(agentMock);
    const createSqlDataSourceSpy = jest
      .spyOn(datasourceSQL, 'createSqlDataSource')
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      .mockReturnValue(datasource);

    const distPathManager = new DistPathManager(os.tmpdir());
    const bootstrapPathManager = new BootstrapPathManager(os.tmpdir(), os.tmpdir(), os.tmpdir());

    return {
      introspection,
      createAgentSpy,
      createSqlDataSourceSpy,
      agentMock,
      datasource,
      distPathManager,
      bootstrapPathManager,
      exitSpy,
    };
  }

  describe('updateTypings', () => {
    it('should create an agent and generate typings from introspection', async () => {
      const {
        introspection,
        createAgentSpy,
        createSqlDataSourceSpy,
        agentMock,
        bootstrapPathManager,
        datasource,
        exitSpy,
      } = setup();
      await updateTypings(introspection, bootstrapPathManager);
      expect(createAgentSpy).toHaveBeenCalledWith({
        authSecret: 'a'.repeat(64),
        envSecret: 'a'.repeat(64),
        loggerLevel: 'Error',
        isProduction: false,
      });
      expect(createSqlDataSourceSpy).toHaveBeenCalledWith(
        {
          dialect: 'sqlite',
          storage: ':memory:',
        },
        { introspection },
      );
      expect(agentMock.addDataSource).toHaveBeenCalledWith(datasource);
      expect(agentMock.updateTypesOnFileSystem).toHaveBeenCalledWith(
        bootstrapPathManager.typingsDuringBootstrap,
        3,
      );
      expect(exitSpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('updateTypingsWithCustomizations', () => {
    describe('if no customization file is found', () => {
      it('should throw a specific business error', async () => {
        const { introspection, distPathManager, bootstrapPathManager } = setup();
        jest.spyOn(fs, 'access').mockRejectedValue(new Error('ENOENT'));

        await expect(
          updateTypingsWithCustomizations(introspection, distPathManager, bootstrapPathManager),
        ).rejects.toEqual(
          new BusinessError(
            `No built customization found at ${path.resolve(
              distPathManager.distCodeCustomizations,
            )}.\nPlease build your code to build your customizations`,
          ),
        );
      });
    });

    describe('if a customization file is found', () => {
      describe('if the customization function throws an error', () => {
        it('should be rethrown as CustomizationError', async () => {
          const { introspection, agentMock, bootstrapPathManager } = setup();
          jest.spyOn(fs, 'access').mockImplementation();
          const distPathManager = new DistPathManager(
            path.join(__dirname, '__data__', 'customization', 'error'),
          );
          await expect(
            updateTypingsWithCustomizations(introspection, distPathManager, bootstrapPathManager),
          ).rejects.toEqual(
            new CustomizationError('Issue with customizations: Error\nSome error occurred'),
          );
          expect(agentMock.updateTypesOnFileSystem).not.toHaveBeenCalled();
        });
      });

      describe('if the customization file does not export a function', () => {
        it('should throw with a specific customization error', async () => {
          const { introspection, agentMock, bootstrapPathManager } = setup();
          jest.spyOn(fs, 'access').mockImplementation();
          const distPathManager = new DistPathManager(
            path.join(__dirname, '__data__', 'customization', 'not-a-function'),
          );
          await expect(
            updateTypingsWithCustomizations(introspection, distPathManager, bootstrapPathManager),
          ).rejects.toEqual(new CustomizationError('Customization file must export a function'));
          expect(agentMock.updateTypesOnFileSystem).not.toHaveBeenCalled();
        });
      });

      it.each(['default', 'exports', 'package'])(
        'if the export strategy is %s',
        async directory => {
          const { introspection, agentMock, bootstrapPathManager } = setup();
          jest.spyOn(fs, 'access').mockImplementation();
          const distPathManager = new DistPathManager(
            path.join(__dirname, '__data__', 'customization', directory),
          );
          await updateTypingsWithCustomizations(
            introspection,
            distPathManager,
            bootstrapPathManager,
          );
          expect(agentMock.updateTypesOnFileSystem).toHaveBeenCalledWith(
            bootstrapPathManager.typings,
            3,
          );
        },
      );
    });
  });
});
