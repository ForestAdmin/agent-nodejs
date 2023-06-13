import * as net from 'net';
import { SocksClient } from 'socks';
import { SocksClientEstablishedEvent } from 'socks/typings/common/constants';

import ReverseProxy from '../../src/connection/reverse-proxy';

beforeEach(() => jest.clearAllMocks());

const proxyOptions = { host: 'localhost', port: 1088 };

describe('ReverseProxy', () => {
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
      const fn = () => new ReverseProxy(proxyOptions, 'localhost', null);

      expect(fn).toThrow();
    });
  });

  describe('when host is not provided', () => {
    it('should throw an error', async () => {
      const fn = () => new ReverseProxy(proxyOptions, null, 10);

      expect(fn).toThrow();
    });
  });

  describe('getError', () => {
    describe('when a connection fails because of the proxy', () => {
      it('should retrieve the error', async () => {
        jest.spyOn(SocksClient, 'createConnection').mockImplementation(() => {
          throw new Error('a proxy error');
        });

        proxy = new ReverseProxy(proxyOptions, 'localhost', 10);
        await proxy.start();

        const client = new net.Socket();
        await new Promise<void>(resolve => {
          client.on('close', () => {
            client.destroy();
            resolve();
          });

          client.connect({ port: proxy.port, host: proxy.host });
        });

        expect(proxy.error).toEqual(new Error('a proxy error'));
      });
    });
  });

  describe('when client open a connection', () => {
    it('should branch the socks5 to the socket', async () => {
      const socks5ProxyMock = { socket: { on: jest.fn(), pipe: jest.fn(), destroy: jest.fn() } };
      jest
        .spyOn(SocksClient, 'createConnection')
        .mockResolvedValue(socks5ProxyMock as unknown as SocksClientEstablishedEvent);

      proxy = new ReverseProxy(proxyOptions, 'localhost', 10);

      await proxy.start();
      const client = new net.Socket();
      await new Promise<void>(resolve => {
        client.on('close', () => {
          client.destroy();
          resolve();
        });

        client.connect({ port: proxy.port, host: proxy.host });
      });

      expect(socks5ProxyMock.socket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(socks5ProxyMock.socket.pipe).toHaveBeenCalledWith(expect.any(net.Socket));
    });
  });

  describe('stop', () => {
    describe('when the server is not started', () => {
      it('should throw an error', async () => {
        proxy = new ReverseProxy(proxyOptions, 'localhost', 10);

        await expect(proxy.stop()).rejects.toThrow();
      });
    });

    describe('when the server is started', () => {
      it('should stop the proxy without error', async () => {
        proxy = new ReverseProxy(proxyOptions, 'localhost', 10);

        await proxy.start();

        await expect(proxy.stop()).resolves.not.toThrow();
      });
    });

    describe('when a connection is opened', () => {
      it('should stop the proxy without throwing error', async () => {
        const socks5ProxyMock = { socket: { on: jest.fn(), pipe: jest.fn(), destroy: jest.fn() } };
        jest
          .spyOn(SocksClient, 'createConnection')
          .mockResolvedValue(socks5ProxyMock as unknown as SocksClientEstablishedEvent);

        proxy = new ReverseProxy(proxyOptions, 'localhost', 10);

        await proxy.start();

        const client = new net.Socket();
        await new Promise<void>(resolve => {
          client.on('close', () => {
            client.destroy();
            resolve();
          });

          client.connect({ port: proxy.port, host: proxy.host });
        });

        await expect(proxy.stop()).resolves.not.toThrow();
      });
    });
  });
});
