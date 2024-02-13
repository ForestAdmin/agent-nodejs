import fs from 'fs/promises';
import { afterEach } from 'node:test';
import path from 'path';

import packager, { distCodeCustomizationsPath, zipPath } from '../../src/services/packager';

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
    await packager();

    expect(jest.mocked(fs).access).toHaveBeenCalled();
    expect(jest.mocked(fs).access).toHaveBeenCalledWith(distCodeCustomizationsPath);

    expect(mockAddLocalFolder).toHaveBeenCalled();
    expect(mockAddLocalFolder).toHaveBeenCalledWith(
      distCodeCustomizationsPath,
      path.join('nodejs', 'customization'),
    );

    expect(mockWriteZipPromise).toHaveBeenCalled();
    expect(mockWriteZipPromise).toHaveBeenCalledWith(zipPath, { overwrite: true });
  });

  describe('when an error occurs while reading zip file', () => {
    it('should throw a business error', async () => {
      jest.mocked(fs.access).mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(packager()).rejects.toThrow(
        /Failed to access directory dist\/code-customizations containing built code:/,
      );
    });
  });
});
