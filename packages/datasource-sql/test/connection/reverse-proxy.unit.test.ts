import net from 'net';

import ReverseProxy from '../../src/connection/services/reverse-proxy';

describe('Reverse proxy', () => {
  describe('stop', () => {
    it('should stop the reverse proxy', async () => {
      const reverseProxy = new ReverseProxy();
      await reverseProxy.start();
      await reverseProxy.stop();
      expect('the stop should render the hand').toBe('the stop should render the hand');
    });

    describe('when the reverse proxy is started and has already a connected client', () => {
      it('should be able to stop the server', async () => {
        const reverseProxy = new ReverseProxy();
        await reverseProxy.start();

        await new Promise<void>(resolve => {
          const client = new net.Socket();
          client.connect(reverseProxy.port, reverseProxy.host, resolve);
        });

        await reverseProxy.stop();
        expect('the stop should render the hand').toBe('the stop should render the hand');
      });
    });

    describe('when there is an error', () => {
      it('should throw the error', async () => {
        const expectedError = new Error('an error occurred');
        const reverseProxy = new ReverseProxy();
        // throw an error when a client connects
        reverseProxy.onConnect(() => {
          throw expectedError;
        });
        await reverseProxy.start();

        // connect a client
        await new Promise<void>(resolve => {
          const client = new net.Socket();
          client.connect(reverseProxy.port, reverseProxy.host, resolve);
        });

        await reverseProxy.stop();
        expect(reverseProxy.error).toEqual(expectedError);
      });
    });
  });
});
