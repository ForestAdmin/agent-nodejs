import { Table } from '@forestadmin/datasource-sql';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as fsP from 'fs/promises';

import { BusinessError } from '../../src/errors';
import bootstrap from '../../src/services/bootstrap';
import BootstrapPathManager from '../../src/services/bootstrap-path-manager';
import HttpServer from '../../src/services/http-server';
import { updateTypings } from '../../src/services/update-typings';
import { EnvironmentVariables } from '../../src/types';

jest.mock('adm-zip');
jest.mock('fs');
jest.mock('fs/promises');

jest.mock('../../src/services/update-typings', () => {
  return {
    default: jest.fn(() => {}),
    updateTypings: jest.fn(),
  };
});

describe('bootstrap', () => {
  const setupMocks = (introspection: Table[]) => {
    jest.resetAllMocks();
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const writeFileSpy = jest.spyOn(fsP, 'writeFile');
    jest.spyOn(fsP, 'readFile').mockImplementation(async () => {
      return `
          env: <FOREST_ENV_SECRET_TO_REPLACE>
          path: <TOKEN_PATH_TO_REPLACE>
          `;
    });
    jest.spyOn(fs, 'createWriteStream').mockReturnValue({
      on: (eventName: string, callback: () => unknown) => {
        callback();
      },
    } as unknown as fs.WriteStream);
    const httpServer = new HttpServer('', '', '');
    const path = new BootstrapPathManager('/tmp', '/my/home/directory');
    jest
      .spyOn(httpServer, 'getDatasources')
      .mockResolvedValue([{ introspection, datasourceSuffix: '_BI' }]);
    HttpServer.downloadCloudCustomizerTemplate = jest.fn();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    jest.mocked(AdmZip).mockReturnValue({ extractAllTo: () => {} });

    return { writeFileSpy, httpServer, path };
  };

  describe('If the target directory exists', () => {
    it('should throw a business error', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const httpServer = new HttpServer('', '', '');
      const path = new BootstrapPathManager('tmp', 'home');
      await expect(
        bootstrap(
          { FOREST_ENV_SECRET: 'abc' } as unknown as EnvironmentVariables,
          httpServer,
          path,
        ),
      ).rejects.toEqual(new BusinessError('You have already a "forest-cloud" folder'));
      expect(fs.existsSync).toHaveBeenCalled();
    });
  });

  describe('If the target directory does not exists', () => {
    describe('If some process fails', () => {
      it('should throw a BusinessError', async () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        const httpServer = new HttpServer('', '', '');
        const path = new BootstrapPathManager('', '');
        HttpServer.downloadCloudCustomizerTemplate = jest
          .fn()
          .mockRejectedValue(new Error('Failed'));

        await expect(
          bootstrap(
            { FOREST_ENV_SECRET: 'abc' } as unknown as EnvironmentVariables,
            httpServer,
            path,
          ),
        ).rejects.toEqual(new BusinessError('Bootstrap failed: Failed.'));
      });

      describe('If there is an error when trying to clear the bootstrap', () => {
        it('should notify the client to clear the "forest-cloud" folder', async () => {
          jest.spyOn(fs, 'existsSync').mockReturnValue(false);
          const httpServer = new HttpServer('', '', '');
          const path = new BootstrapPathManager('', '');
          HttpServer.downloadCloudCustomizerTemplate = jest
            .fn()
            .mockRejectedValue(new Error('Failed'));
          // throw error when trying to clear
          jest.spyOn(fsP, 'rm').mockRejectedValue(new Error('Failed'));

          await expect(
            bootstrap(
              { FOREST_ENV_SECRET: 'abc' } as unknown as EnvironmentVariables,
              httpServer,
              path,
            ),
          ).rejects.toEqual(
            new BusinessError(
              'Bootstrap failed: Failed.\nPlease remove "forest-cloud" folder and re-run bootstrap command.',
            ),
          );
        });
      });
    });

    describe('If no dependency call fails', () => {
      it('should run the bootstrap completely', async () => {
        const introspection: Table[] = [
          {
            name: 'towns',
            schema: 'public',
            unique: [['code', 'department'], ['id']],
            columns: [
              {
                name: 'id',
                type: {
                  type: 'scalar',
                  subType: 'NUMBER',
                },
                allowNull: false,
                primaryKey: true,
                constraints: [],
                defaultValue: null,
                autoIncrement: true,
                isLiteralDefaultValue: true,
              },
            ],
          },
        ];
        const { writeFileSpy, httpServer, path } = setupMocks(introspection);

        const renameSpy = jest.spyOn(fsP, 'rename').mockResolvedValue();
        const rmSpy = jest.spyOn(fsP, 'rm').mockResolvedValue();

        await bootstrap(
          { FOREST_ENV_SECRET: 'abc' } as unknown as EnvironmentVariables,
          httpServer,
          path,
        );

        expect(HttpServer.downloadCloudCustomizerTemplate).toHaveBeenCalled();
        expect(HttpServer.downloadCloudCustomizerTemplate).toHaveBeenCalledWith(
          '/tmp/cloud-customizer.zip',
        );
        expect(renameSpy).toHaveBeenCalledWith('/tmp/cloud-customizer-main', 'forest-cloud');
        expect(rmSpy).toHaveBeenCalledWith('/tmp/cloud-customizer.zip', { force: true });

        expect(writeFileSpy).toHaveBeenCalledTimes(2);
        const firstCallArgs = writeFileSpy.mock.calls[0];
        expect(firstCallArgs[0]).toBe('forest-cloud/.env');
        expect(firstCallArgs[1].toString().replace(/\s/g, '')).toBe(
          `
              env: abc
              path: /my/home/directory
              `.replace(/\s/g, ''),
        );
        const secondCallArgs = writeFileSpy.mock.calls[1];
        expect(secondCallArgs[0]).toBe('forest-cloud/src/index.ts');
        expect(secondCallArgs[1].toString().replace(/\s/g, '')).toBe(
          `
          env: <FOREST_ENV_SECRET_TO_REPLACE>
          path: <TOKEN_PATH_TO_REPLACE>
              `.replace(/\s/g, ''),
        );
        expect(updateTypings).toHaveBeenCalled();
        expect(updateTypings).toHaveBeenCalledWith(
          [{ introspection, datasourceSuffix: '_BI' }],
          path,
        );
      });
    });
  });
});
