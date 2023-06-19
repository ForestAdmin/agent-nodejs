import net from 'net';

import Service from './service';

/**
 * ReverseProxy is used to redirect all the database requests.
 * Sequelize does not take a socket as an argument,
 * so we need to redirect all the traffic to a new socket.
 * This is done by creating a server that will listen on a random port.
 * We change the host and port of the Sequelize options to point to the reverse proxy.
 * The reverse proxy will then redirect all the traffic to the database through the tunnel.
 */
export default class ReverseProxy extends Service {
  private readonly server: net.Server;

  get host(): string {
    return (this.server.address() as net.AddressInfo).address;
  }

  get port(): number {
    return (this.server.address() as net.AddressInfo).port;
  }

  constructor() {
    super();
    this.server = net.createServer(this.connect.bind(this));
  }

  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.on('error', reject);
      // By using port 0, the operating system
      // will assign an available port for the server to listen on.
      this.server.listen(0, '127.0.0.1', resolve);
    });
  }

  override async stop(): Promise<void> {
    try {
      // close all the connected clients before closing the server
      await super.stop();
    } finally {
      await new Promise<void>((resolve, reject) => {
        this.server.close(e => {
          if (e) reject(e);
          else resolve();
        });
      });
    }
  }

  protected override async connect(socket: net.Socket): Promise<net.Socket> {
    try {
      this.connectedClients.add(socket);
      this.onCloseEventDestroySocket(socket, socket);
      this.onErrorEventDestroySocket(socket, socket);
      const tunnel = await super.connect();

      if (tunnel) {
        return tunnel.pipe(socket).pipe(tunnel);
      }
    } catch (error) {
      this.errors.push(error);
      socket.emit('error', error);
      // don't throw the error to avoid crashing the server because the error is already handled
    }
  }
}
