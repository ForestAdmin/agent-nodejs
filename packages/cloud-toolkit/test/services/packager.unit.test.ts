import fs from 'fs/promises';
import { afterEach } from 'node:test';
import path from 'path';

import DistPathManager from '../../src/services/dist-path-manager';
import packager from '../../src/services/packager';

const mockAddLocalFolder = jest.fn();
const mockWriteZipPromise = jest.fn();

jest.mock('adm-zip', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addLocalFolder: mockAddLocalFolder,
    writeZipPromise: mockWriteZipPromise,
  })),
}));
jest.mock('fs/promises');

describe('packager', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should create a zip file containing the customizations', async () => {
    const distPath = new DistPathManager();
    await packager(distPath);

    expect(jest.mocked(fs).access).toHaveBeenCalled();
    expect(jest.mocked(fs).access).toHaveBeenCalledWith(distPath.distCodeCustomizations);

    expect(mockAddLocalFolder).toHaveBeenCalled();
    expect(mockAddLocalFolder).toHaveBeenCalledWith(
      distPath.distCodeCustomizations,
      path.join('nodejs', 'customization'),
    );

    expect(mockWriteZipPromise).toHaveBeenCalled();
    expect(mockWriteZipPromise).toHaveBeenCalledWith(distPath.zip, { overwrite: true });
  });

  describe('when an error occurs while reading zip file', () => {
    it('should throw a business error', async () => {
      jest.mocked(fs.access).mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(packager(new DistPathManager())).rejects.toThrow(
        /Failed to access directory dist\/code-customizations containing built code:/,
      );
    });
  });
});
