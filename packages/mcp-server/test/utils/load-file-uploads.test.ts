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

  it('names the module and the resolved path when it cannot be found', async () => {
    await expect(loadFileUploads('./does-not-exist.js')).rejects.toThrow(
      /"\.\/does-not-exist\.js" was not found \(resolved to .+\)/,
    );
  });

  // "your path is wrong" and "your module rejected its own config" send the operator elsewhere.
  it('separates a module that ran and failed from one that is absent', async () => {
    const file = writeModule(`throw new Error('FOREST_S3_BUCKET is not set');`);

    const error = (await loadFileUploads(file).catch((e: Error) => e)) as Error & {
      cause?: unknown;
    };

    expect(error.message).toContain('failed while loading: FOREST_S3_BUCKET is not set');
    expect(error.message).not.toContain('was not found');
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('names the module when its factory rejects', async () => {
    const file = writeModule(`module.exports = async () => { throw new Error('no bucket'); };`);

    await expect(loadFileUploads(file)).rejects.toThrow(
      /failed while building the options: no bucket/,
    );
  });

  it('describes a module that throws something that is not an Error', async () => {
    const file = writeModule(`throw 'nope';`);

    await expect(loadFileUploads(file)).rejects.toThrow(/failed while loading: nope/);
  });

  // The variable exists for the storage, so a storage that is present but broken must not fall
  // back to the very backend the operator was configuring their way out of.
  it.each([
    ['undefined', 'module.exports = { storage: undefined };'],
    ['not an object', 'module.exports = { storage: "s3" };'],
    [
      'missing getSize',
      'module.exports = { storage: { createUploadUrl: () => {}, download: () => {} } };',
    ],
  ])('rejects a storage that is %s instead of falling back to memory', async (_, body) => {
    const file = writeModule(body);

    await expect(loadFileUploads(file)).rejects.toThrow(/exports a storage missing/);
  });

  // Omitting the storage selects the in-memory store, so it must not be an error.
  it('accepts options without a storage', async () => {
    const file = writeModule(`module.exports = { maxBytes: 10 };`);

    await expect(loadFileUploads(file)).resolves.toEqual({ maxBytes: 10 });
  });

  it.each([
    ['a function returning nothing', 'module.exports = () => undefined;'],
    ['a module exporting null', 'module.exports = null;'],
  ])('rejects %s, which is a module that forgot to export', async (_, body) => {
    const file = writeModule(body);

    await expect(loadFileUploads(file)).rejects.toThrow('must export the fileUploads options');
  });
});
