import type { Logger } from '../../src/server';
import type { Express } from 'express';

import express from 'express';
import * as http from 'http';
import request from 'supertest';

import EphemeralStorage from '../../src/file-uploads/ephemeral-storage';

describe('EphemeralStorage', () => {
  let storage: EphemeralStorage;
  let app: Express;
  let logger: jest.MockedFunction<Logger>;

  const configure = (options: Partial<Parameters<EphemeralStorage['configure']>[0]> = {}) => {
    storage.configure({
      maxBytes: 1024,
      maxTotalBytes: 4096,
      ttlSeconds: 60,
      issuedTtlSeconds: 900,
      publicBaseUrl: 'https://agent.example/mcp/uploads',
      ...options,
    });
  };

  const put = async (key: string, body: string | Buffer) => {
    await storage.createUploadUrl({ key });

    return request(app)
      .put(`/${encodeURIComponent(key)}`)
      .send(body);
  };

  beforeEach(() => {
    jest.useRealTimers();
    logger = jest.fn();
    storage = new EphemeralStorage();
    configure();

    app = express();
    app.use('/', storage.createRouter(logger));
  });

  describe('createUploadUrl', () => {
    it('points at the configured origin, with the key encoded as one segment', async () => {
      const { url, method } = await storage.createUploadUrl({ key: 'mcp-uploads/uuid/a b.pdf' });

      expect(url).toBe('https://agent.example/mcp/uploads/mcp-uploads%2Fuuid%2Fa%20b.pdf');
      expect(method).toBe('PUT');
    });

    it('does not double the separator when the base url ends with one', async () => {
      configure({ publicBaseUrl: 'https://agent.example/mcp/uploads/' });

      const { url } = await storage.createUploadUrl({ key: 'k' });

      expect(url).toBe('https://agent.example/mcp/uploads/k');
    });
  });

  describe('round trip', () => {
    it('returns the exact bytes that were uploaded', async () => {
      const body = Buffer.from('CONTENU-BINAIRE-\0ÿ-avec des accents');

      await expect(put('mcp-uploads/uuid/rapport final;v2.pdf', body)).resolves.toMatchObject({
        status: 200,
      });

      const key = 'mcp-uploads/uuid/rapport final;v2.pdf';
      await expect(storage.getSize(key)).resolves.toBe(body.length);
      await expect(storage.download(key)).resolves.toEqual(body);

      // Single-use against this backend: keeping consumed objects would fill a small store.
      await expect(storage.getSize(key)).resolves.toBeUndefined();
    });

    it('accepts an empty upload', async () => {
      await put('k', Buffer.alloc(0));

      await expect(storage.download('k')).resolves.toHaveLength(0);
    });

    it('replaces an object uploaded twice without leaking its size', async () => {
      configure({ maxBytes: 1024, maxTotalBytes: 2048 });

      await put('k', Buffer.alloc(600));
      await put('k', Buffer.alloc(700));

      await expect(storage.getSize('k')).resolves.toBe(700);
      // Counting the replaced 600 too would total 2300 here and refuse this upload.
      await expect(put('other', Buffer.alloc(1000))).resolves.toMatchObject({ status: 200 });
    });

    // The replacement only has to fit next to the *other* objects, not next to the one it evicts.
    it('accepts a replacement that alone fills the store', async () => {
      configure({ maxBytes: 1024, maxTotalBytes: 1024 });
      await put('k', Buffer.alloc(1000));

      await expect(put('k', Buffer.alloc(1000))).resolves.toMatchObject({ status: 200 });
      await expect(storage.getSize('k')).resolves.toBe(1000);
    });
  });

  describe('limits', () => {
    it('refuses a body over maxBytes', async () => {
      const response = await put('k', Buffer.alloc(2000));

      expect(response.status).toBe(413);
      await expect(storage.getSize('k')).resolves.toBeUndefined();
    });

    it('refuses a body that would take the store over its total, mid-stream', async () => {
      await put('a', Buffer.alloc(1000));
      await put('b', Buffer.alloc(1000));
      await put('c', Buffer.alloc(1000));
      await put('d', Buffer.alloc(1000));

      const response = await put('e', Buffer.alloc(1000));

      expect(response.status).toBe(413);
      await expect(storage.getSize('e')).resolves.toBeUndefined();
    });

    it('refuses before reading a byte once the store is exactly full', async () => {
      configure({ maxBytes: 1024, maxTotalBytes: 2048 });
      await put('a', Buffer.alloc(1024));
      await put('b', Buffer.alloc(1024));

      const response = await put('c', Buffer.from('x'));

      expect(response.status).toBe(507);
      expect(logger).toHaveBeenCalledWith('Warn', expect.stringContaining('store is full'));
    });

    it('answers before reading when the declared size cannot fit', async () => {
      await storage.createUploadUrl({ key: 'k' });

      const response = await request(app)
        .put('/k')
        .set('content-length', '99999999')
        .send(Buffer.alloc(4));

      expect(response.status).toBe(413);
      expect(response.body).toEqual({ error: expect.stringContaining('larger than the 1024') });
    });

    // Reached when the body fits on its own but the store does not have room: the refusal happens
    // on a chunk, and the rest must be dropped rather than accumulated or answered twice.
    it('stops accumulating once it has refused mid-stream', async () => {
      configure({ maxBytes: 1024, maxTotalBytes: 1200 });
      await put('a', Buffer.alloc(1000));

      const response = await put('b', Buffer.alloc(1000));

      expect(response.status).toBe(413);
      expect(response.body).toEqual({ error: expect.stringContaining('store is full') });
      await expect(storage.getSize('b')).resolves.toBeUndefined();
    });

    // A chunked body declares no size, so the pre-check cannot see it and the refusal happens on
    // the chunk that goes over. The chunks after it must be dropped, not accumulated.
    it('refuses a chunked body over maxBytes, which declares no size', async () => {
      configure({ maxBytes: 150 });
      await storage.createUploadUrl({ key: 'k' });
      const server = app.listen(0);
      const { port } = server.address() as { port: number };

      const status = await new Promise<number>(resolve => {
        const req = http.request({ port, method: 'PUT', path: '/k' }, res =>
          resolve(res.statusCode),
        );

        const write = (remaining: number) => {
          if (!remaining) return req.end();
          req.write(Buffer.alloc(100));
          // Spaced out so they arrive as separate chunks rather than one coalesced read.
          setTimeout(() => write(remaining - 1), 10);
        };

        write(3);
      });

      server.close();
      expect(status).toBe(413);
      await expect(storage.getSize('k')).resolves.toBeUndefined();
    });

    // Substituting the bytes of an upload that already landed is the one thing a leaked url could
    // still do, so the authorization is consumed. A retry must say that, not blame a ttl.
    it('names the used url rather than blaming a ttl on a second upload', async () => {
      await put('k', Buffer.from('first'));

      const response = await request(app).put('/k').send('second');

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: expect.stringContaining('already used') });
      await expect(storage.download('k')).resolves.toEqual(Buffer.from('first'));
    });

    it('stops accepting an upload url that was never used in time', async () => {
      configure({ issuedTtlSeconds: 60 });
      await storage.createUploadUrl({ key: 'k' });

      jest.useFakeTimers().setSystemTime(Date.now() + 61_000);

      const response = await request(app).put('/k').send('x');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: expect.stringContaining('no upload was authorized') });
    });

    it('serves the next upload once an object expired', async () => {
      configure({ ttlSeconds: 60, maxTotalBytes: 1024 });
      await put('a', Buffer.alloc(1000));

      jest.useFakeTimers().setSystemTime(Date.now() + 61_000);

      await expect(put('b', Buffer.alloc(1000))).resolves.toMatchObject({ status: 200 });
    });
  });

  describe('expiry', () => {
    it('forgets an object past its ttl', async () => {
      await put('k', Buffer.from('hi'));

      jest.useFakeTimers().setSystemTime(Date.now() + 61_000);

      await expect(storage.getSize('k')).resolves.toBeUndefined();
    });
  });

  describe('download of a missing object', () => {
    // A refused upload, an expired one and a replica that never saw it are the same absence from
    // here, so the message has to name all three rather than pick one and send the reader after it.
    it('names every cause an absence can have', async () => {
      await expect(storage.download('never-uploaded')).rejects.toThrow(
        /the upload never completed .* or it expired after handleTtlSeconds, or it reached another instance/,
      );
    });
  });

  // Allocating the body can fail, and a throw in this listener is an uncaughtException that takes
  // the whole agent down rather than this one request.
  it('answers 500 when the body cannot be allocated', async () => {
    jest.spyOn(Buffer, 'concat').mockImplementationOnce(() => {
      throw new Error('Array buffer allocation failed');
    });

    const response = await put('k', Buffer.from('hi'));

    expect(response.status).toBe(500);
    expect(logger).toHaveBeenCalledWith('Error', expect.stringContaining('allocation failed'));
  });

  // The path a real client abort takes, which is the most common failure here. Silence would leave
  // an upload that vanished with no trace anywhere.
  it('logs an upload the client aborted', async () => {
    await storage.createUploadUrl({ key: 'k' });
    const server = app.listen(0);
    const { port } = server.address() as { port: number };

    await new Promise<void>(resolve => {
      const req = http.request(
        { port, method: 'PUT', path: '/k', headers: { 'content-length': '400' } },
        () => undefined,
      );

      req.on('error', () => resolve());
      req.write(Buffer.alloc(100));
      setTimeout(() => {
        req.destroy(new Error('aborted by the client'));
      }, 20);
    });

    await new Promise(resolve => {
      setTimeout(resolve, 50);
    });
    server.close();

    expect(logger).toHaveBeenCalledWith('Warn', expect.stringContaining('failed after'));
    await expect(storage.getSize('k')).resolves.toBeUndefined();
  });

  it('answers nothing but PUT', async () => {
    await expect(request(app).get('/k')).resolves.toMatchObject({ status: 404 });
    await expect(request(app).post('/k').send('x')).resolves.toMatchObject({ status: 404 });
  });
});
