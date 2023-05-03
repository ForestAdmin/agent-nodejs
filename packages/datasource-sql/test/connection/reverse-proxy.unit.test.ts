import * as net from 'net';
import { SocksClient } from 'socks';

import ReverseProxy from '../../src/connection/reverse-proxy';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('proxy utils', () => {
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
  afterEach(() => proxy?.stop());

  describe('getError', () => {
    describe('when a connection fails because of the proxy', () => {
      it('should throw the proxy error and stop the proxy', async () => {
        jest.spyOn(SocksClient, 'createConnection').mockImplementation(() => {
          throw new Error('a proxy error');
        });
        proxy = new ReverseProxy(makeProxyOptions());
        jest.spyOn(proxy, 'stop');

        await proxy.start();
        const client = new net.Socket();
        const url = new URL(proxy.connectionOptions.uri);
        await new Promise<void>(resolve => {
          client.on('close', () => {
            client.destroy();
            resolve();
          });

          client.connect({ port: Number(url.port), host: url.hostname, family: 4 });
        });
        expect(proxy.getError()).toEqual(new Error('a proxy error'));
      });
    });
  });

  describe('when client open a connection', () => {
    it('should branch the socks5 to the socket', async () => {
      const socks5ProxyMock = {
        socket: {
          on: jest.fn(),
          pipe: jest.fn(),
        },
      };
      jest.spyOn(SocksClient, 'createConnection').mockResolvedValue(socks5ProxyMock as any);
      proxy = new ReverseProxy(makeProxyOptions());

      await proxy.start();
      const client = new net.Socket();
      const url = new URL(proxy.connectionOptions.uri);
      await new Promise<void>(resolve => {
        client.connect({ port: Number(url.port), host: url.hostname, family: 4 }, resolve);
      });

      expect(socks5ProxyMock.socket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(socks5ProxyMock.socket.pipe).toHaveBeenCalledWith(expect.any(net.Socket));
    });

    describe('when it takes an options with uri', () => {
      it('gives updated options with updated uri, host and port', async () => {
        const options = makeProxyOptions();
        proxy = new ReverseProxy(options);

        await proxy.start();

        expect(proxy.connectionOptions).not.toEqual({
          host: options.proxySocks.host,
          port: options.proxySocks.port,
          proxySocks: options.proxySocks,
          uri: expect.any(String),
        });

        expect(proxy.connectionOptions).toEqual({
          host: expect.any(String),
          port: expect.any(Number),
          proxySocks: options.proxySocks,
          uri: expect.any(String),
        });
      });
    });
  });
});
