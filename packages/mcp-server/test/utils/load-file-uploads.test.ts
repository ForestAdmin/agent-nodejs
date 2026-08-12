import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import loadFileUploads from '../../src/utils/load-file-uploads';

describe('loadFileUploads', () => {
  const written: string[] = [];

  const writeModule = (body: string) => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-uploads-')), 'storage.js');
    fs.writeFileSync(file, body);
    written.push(file);

    return file;
  };

  const storageSource = `{
    createUploadUrl: async () => ({ url: 'https://storage.example/put' }),
    download: async () => Buffer.from('x'),
    getSize: async () => undefined,
  }`;

  afterAll(() => written.forEach(file => fs.rmSync(path.dirname(file), { recursive: true })));

  it('returns undefined when no module is configured', async () => {
    await expect(loadFileUploads(undefined)).resolves.toBeUndefined();
    await expect(loadFileUploads('')).resolves.toBeUndefined();
  });

  it('loads options exported directly', async () => {
    const file = writeModule(`module.exports = { storage: ${storageSource}, maxBytes: 4242 };`);

    const options = await loadFileUploads(file);

    expect(options?.maxBytes).toBe(4242);
    expect(typeof options?.storage.download).toBe('function');
  });

  it('loads options returned by a function', async () => {
    const file = writeModule(`module.exports = () => ({ storage: ${storageSource} });`);

    const options = await loadFileUploads(file);

    expect(typeof options?.storage.createUploadUrl).toBe('function');
  });

  it('awaits a function returning a promise', async () => {
    const file = writeModule(`module.exports = async () => ({ storage: ${storageSource} });`);

    await expect(loadFileUploads(file)).resolves.toMatchObject({
      storage: expect.any(Object),
    });
  });

  it('names the module and the resolved path when it cannot be loaded', async () => {
    await expect(loadFileUploads('./does-not-exist.js')).rejects.toThrow(
      /Cannot load FOREST_MCP_UPLOAD_STORAGE_MODULE "\.\/does-not-exist\.js" \(resolved to .+\)/,
    );
  });

  it('rejects a module that exports no storage, rather than starting without uploads', async () => {
    const file = writeModule(`module.exports = { maxBytes: 10 };`);

    await expect(loadFileUploads(file)).rejects.toThrow('must export { storage }');
  });

  it('rejects a function that returns no storage', async () => {
    const file = writeModule(`module.exports = () => undefined;`);

    await expect(loadFileUploads(file)).rejects.toThrow('must export { storage }');
  });
});
