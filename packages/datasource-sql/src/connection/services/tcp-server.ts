import net from 'net';

import Service from './service';

/** TcpServer is used as proxy to redirect all the database requests */
export default class TcpServer extends Service {
  private readonly server: net.Server;

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
    await this.stop();
  }
}
