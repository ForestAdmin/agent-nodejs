import net from 'net';

import Service from './service';

/** TcpServer is used as proxy to redirect all the database requests */
export default class ReverseProxy extends Service {
  private readonly server: net.Server;
  private readonly connectedClients: Set<net.Socket> = new Set();

  get host(): string {
    return (this.server.address() as net.AddressInfo).address;
  }

  get port(): number {
    return (this.server.address() as net.AddressInfo).port;
  }

  constructor() {
    super();
    this.server = net.createServer(this.connectListener.bind(this));
  }

  override async connectListener(socket: net.Socket): Promise<net.Socket> {
    this.connectedClients.add(socket);
    socket.on('error', error => this.destroySocketAndSaveError(socket, error));
    socket.on('close', () => this.destroySocketAndSaveError(socket));

    const tunnel = await super.connectListener();
    // tunnel was not built, close the connection
    if (!tunnel) return socket.destroy();

    return tunnel.pipe(socket).pipe(tunnel);
  }

  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.on('error', reject);
      // By using port 0, the operating system
      // will assign an available port for the server to listen on.
      this.server.listen(0, '127.0.0.1', resolve);
    });
  }

  async stop(): Promise<void> {
    try {
      await super.closeListener();
    } finally {
      await new Promise<void>((resolve, reject) => {
        this.server.close(e => {
          if (e) reject(e);
          else resolve();
        });
      });
    }
  }

  override async closeListener(): Promise<void> {
    // close all the connected clients to be able to close the server
    this.connectedClients.forEach(client => client.destroy());
    await this.stop();
  }
}
