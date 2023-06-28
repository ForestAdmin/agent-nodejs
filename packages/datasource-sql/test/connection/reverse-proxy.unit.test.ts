import net from 'net';

import ReverseProxy from '../../src/connection/services/reverse-proxy';
import Service from '../../src/connection/services/service';

describe('Reverse proxy', () => {
  const makeAServiceWithAnErrorWhenConnecting = () => {
    class Service1 extends Service {
      errorToThrow: Error = null;
      protected override async connect(): Promise<net.Socket> {
        throw this.errorToThrow;
      }
    }

    return new Service1(null, null, null, null);
  };

  describe('stop', () => {
    it('should stop the reverse proxy', async () => {
      const reverseProxy = new ReverseProxy();
      await reverseProxy.start();
      await reverseProxy.stop();
      expect(reverseProxy.error).toBe(null);
    });

    describe('when the reverse proxy is started and has already a connected client', () => {
      it('should be able to stop the server', async () => {
        const reverseProxy = new ReverseProxy();
        await reverseProxy.start();

        await new Promise<void>(resolve => {
          const client = new net.Socket();
          client.on('error', () => {});
          client.connect(reverseProxy.port, reverseProxy.host, resolve);
        });

        await reverseProxy.stop();
        expect(reverseProxy.error).toBe(null);
      });
    });

    describe('when there is an error on the connect', () => {
      it('should throw the error', async () => {
        const expectedError = new Error('an error occurred');
        const reverseProxy = new ReverseProxy();
        // throw an error when a client connects
        const service = makeAServiceWithAnErrorWhenConnecting();
        service.errorToThrow = expectedError;
        reverseProxy.link(service);
        await reverseProxy.start();

        // connect a client
        await new Promise<void>(resolve => {
          const client = new net.Socket();
          client.on('close', resolve);
          client.connect(reverseProxy.port, reverseProxy.host);
        });

        await reverseProxy.stop();
        expect(reverseProxy.error).toEqual(expectedError);
      });
    });
  });
});
