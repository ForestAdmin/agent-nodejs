import * as net from 'net';
import { SocksClient } from 'socks';

import ReverseProxy from '../../src/connection/reverse-proxy';

beforeEach(() => jest.clearAllMocks());

describe('ReverseProxy', () => {
  const makeProxyOptions = () => ({
    host: 'localhost',
    port: 10,
    uri: 'http://localhost:10',
    proxySocks: {
      host: 'localhost',
      port: 1088,
    },
  });
  let proxy: ReverseProxy;
  afterEach(async () => {
    try {
      await proxy?.stop();
    } catch (e) {
      /* empty */
    }
  });

  describe('when port is not provided', () => {
    it('should throw an error', async () => {
      const options = { ...makeProxyOptions(), uri: null, port: null, host: 'localhost' };
      expect(() => new ReverseProxy(options)).toThrow();
    });
  });

  describe('when host is not provided', () => {
    it('should throw an error', async () => {
      const options = { ...makeProxyOptions(), uri: null, host: null };
      expect(() => new ReverseProxy(options)).toThrow();
    });
  });

  describe('getError', () => {
    describe('when a connection fails because of the proxy', () => {
      it('should retrieve the error', async () => {
        jest.spyOn(SocksClient, 'createConnection').mockImplementation(() => {
          throw new Error('a proxy error');
        });
        proxy = new ReverseProxy(makeProxyOptions());
        await proxy.start();

        const client = new net.Socket();
        await new Promise<void>(resolve => {
          client.on('close', () => {
            client.destroy();
            resolve();
          });

          const { port, host } = proxy.connectionOptions;
          client.connect({ port: Number(port), host });
        });

        expect(proxy.getError()).toEqual(new Error('a proxy error'));
      });
    });
  });

  describe('when client open a connection', () => {
    it('should branch the socks5 to the socket', async () => {
      const socks5ProxyMock = { socket: { on: jest.fn(), pipe: jest.fn() } };
      jest.spyOn(SocksClient, 'createConnection').mockResolvedValue(socks5ProxyMock as any);
      proxy = new ReverseProxy(makeProxyOptions());

      await proxy.start();
      const client = new net.Socket();
      await new Promise<void>(resolve => {
        client.on('close', () => {
          client.destroy();
          resolve();
        });

        const { port, host } = proxy.connectionOptions;
        client.connect({ port: Number(port), host });
      });

      expect(socks5ProxyMock.socket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(socks5ProxyMock.socket.pipe).toHaveBeenCalledWith(expect.any(net.Socket));
    });
  });

  describe('connectionOptions', () => {
    describe('when it takes an options with uri', () => {
      it('gives updated options with updated uri, host and port', async () => {
        const options = {
          ...makeProxyOptions(),
          host: null,
          port: null,
          uri: 'http://localhost:10',
        };
        proxy = new ReverseProxy(options);

        await proxy.start();

        expect(proxy.connectionOptions.host).not.toEqual(options.host);
        expect(proxy.connectionOptions.port).not.toEqual(options.port);
        expect(proxy.connectionOptions.uri).not.toEqual(options.uri);

        expect(proxy.connectionOptions).toEqual({
          host: expect.any(String),
          port: expect.any(Number),
          proxySocks: options.proxySocks,
          uri: expect.any(String),
        });
      });
    });

    describe('when it takes an options without uri', () => {
      it('gives updated options with host and port', async () => {
        const options = { ...makeProxyOptions(), uri: null, port: 10, host: 'localhost' };
        proxy = new ReverseProxy(options);

        await proxy.start();

        expect(proxy.connectionOptions.host).not.toEqual(options.host);
        expect(proxy.connectionOptions.port).not.toEqual(options.port);

        expect(proxy.connectionOptions).toEqual({
          host: expect.any(String),
          port: expect.any(Number),
          proxySocks: options.proxySocks,
          uri: null,
        });
      });
    });
  });

  describe('stop', () => {
    describe('when the server is not started', () => {
      it('should throw an error', async () => {
        proxy = new ReverseProxy(makeProxyOptions());

        await expect(proxy.stop()).rejects.toThrow();
      });
    });

    describe('when the server is started', () => {
      it('should stop the proxy without error', async () => {
        proxy = new ReverseProxy(makeProxyOptions());

        await proxy.start();

        await expect(proxy.stop()).resolves.not.toThrow();
      });
    });

    describe('when a connection is opened', () => {
      it('should stop the proxy without throwing error', async () => {
        const socks5ProxyMock = { socket: { on: jest.fn(), pipe: jest.fn() } };
        jest.spyOn(SocksClient, 'createConnection').mockResolvedValue(socks5ProxyMock as any);

        proxy = new ReverseProxy(makeProxyOptions());

        await proxy.start();

        const client = new net.Socket();
        await new Promise<void>(resolve => {
          client.on('close', () => {
            client.destroy();
            resolve();
          });

          const { port, host } = proxy.connectionOptions;
          client.connect({ port: Number(port), host });
        });

        await expect(proxy.stop()).resolves.not.toThrow();
      });
    });
  });
});
